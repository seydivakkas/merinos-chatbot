#!/bin/bash
# ================================================================================
# MERINOS FULL PIPELINE - Tek komutla tüm süreç
# ================================================================================
# Kullanım:
#   chmod +x run_full_pipeline.sh
#   ./run_full_pipeline.sh --mode all
#   ./run_full_pipeline.sh --mode train
#   ./run_full_pipeline.sh --mode eval
#   ./run_full_pipeline.sh --mode deploy
# ================================================================================

set -e  # Hata durumunda dur

# Renkler
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Varsayılanlar
MODE="all"
MODEL="unsloth/Qwen2.5-7B-Instruct-bnb-4bit"
DATA_DIR="./split/chatml"
OUTPUT_DIR="./merinos_7b_8gb"
EPOCHS=3
SEQ_LENGTH=768
LORA_R=8
BATCH_SIZE=1
GRAD_ACCUM=8
MAX_SAMPLES=100
JUDGE_MODEL="unsloth/gemma-2-9b-it-bnb-4bit"

# Argüman parse
while [[ $# -gt 0 ]]; do
  case $1 in
    --mode) MODE="$2"; shift 2 ;;
    --model) MODEL="$2"; shift 2 ;;
    --epochs) EPOCHS="$2"; shift 2 ;;
    --seq_length) SEQ_LENGTH="$2"; shift 2 ;;
    --lora_r) LORA_R="$2"; shift 2 ;;
    --output_dir) OUTPUT_DIR="$2"; shift 2 ;;
    *) echo "Bilinmeyen argüman: $1"; exit 1 ;;
  esac
done

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ================================================================================
# FONKSIYONLAR
# ================================================================================

step_0_prerequisites() {
    log_info "0. Ön kontroller..."

    # Python
    if ! command -v python3 &> /dev/null; then
        log_error "Python3 bulunamadı. Lütfen yükleyin."
        exit 1
    fi

    # CUDA
    if ! python3 -c "import torch; assert torch.cuda.is_available()" 2>/dev/null; then
        log_error "CUDA destekli GPU bulunamadı!"
        exit 1
    fi

    GPU_NAME=$(python3 -c "import torch; print(torch.cuda.get_device_name(0))")
    VRAM=$(python3 -c "import torch; print(f'{torch.cuda.get_device_properties(0).total_memory/1024**3:.1f}')")
    log_success "GPU: $GPU_NAME | VRAM: ${VRAM}GB"

    # Gereksinimler
    if [ ! -f "requirements.txt" ]; then
        log_warn "requirements.txt bulunamadı"
    else
        pip install -q -r requirements.txt
        log_success "Gereksinimler yüklendi"
    fi

    # Dizinler
    mkdir -p "$OUTPUT_DIR"
    mkdir -p ./evaluation_results
    mkdir -p ./rag_index
}

step_1_vram_test() {
    log_info "1. VRAM Benchmark..."
    python3 vram_benchmark.py \
        --seq_length "$SEQ_LENGTH" \
        --lora_r "$LORA_R" \
        --batch_size "$BATCH_SIZE"

    # Sonuçları kontrol et
    BENCHMARK_FILE=$(ls benchmark_seq${SEQ_LENGTH}_r${LORA_R}.json 2>/dev/null | head -1)
    if [ -f "$BENCHMARK_FILE" ]; then
        RISK=$(python3 -c "import json; d=json.load(open('$BENCHMARK_FILE')); print(d.get('risk','UNKNOWN'))")
        if [[ "$RISK" == *"🔴"* ]] || [[ "$RISK" == *"OOM"* ]]; then
            log_error "VRAM benchmark OOM riski tespit etti!"
            log_warn "Öneri: seq_length düşürün (768 -> 512) veya lora_r düşürün (8 -> 4)"
            read -p "Devam etmek istiyor musunuz? (y/N) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        else
            log_success "VRAM benchmark: $RISK"
        fi
    fi
}

step_2_train() {
    log_info "2. Fine-tuning eğitimi..."
    log_info "   Model: $MODEL"
    log_info "   Epochs: $EPOCHS | Seq: $SEQ_LENGTH | LoRA r: $LORA_R"
    log_info "   Bu işlem uzun sürecek. Lütfen bekleyin..."

    python3 train_7b_aggressive.py \
        --model "$MODEL" \
        --data_dir "$DATA_DIR" \
        --seq_length "$SEQ_LENGTH" \
        --epochs "$EPOCHS" \
        --batch_size "$BATCH_SIZE" \
        --grad_accum "$GRAD_ACCUM" \
        --lora_r "$LORA_R" \
        --lora_alpha $((LORA_R * 2)) \
        --packing \
        --vram_limit 7.4 \
        --output_dir "$OUTPUT_DIR" \
        --save_steps 500 \
        --logging_steps 25

    if [ -f "$OUTPUT_DIR/training_stats.json" ]; then
        PEAK_VRAM=$(python3 -c "import json; d=json.load(open('$OUTPUT_DIR/training_stats.json')); print(d.get('peak_vram_gb','N/A'))")
        FINAL_LOSS=$(python3 -c "import json; d=json.load(open('$OUTPUT_DIR/training_stats.json')); print(d.get('final_loss','N/A'))")
        log_success "Eğitim tamamlandı! Peak VRAM: ${PEAK_VRAM}GB | Final Loss: ${FINAL_LOSS}"
    else
        log_error "Eğitim başarısız! training_stats.json bulunamadı."
        exit 1
    fi
}

step_3_merge() {
    log_info "3. Model birleştirme (LoRA + Base)..."
    python3 merge_model.py \
        --base "$MODEL" \
        --lora "$OUTPUT_DIR/lora_adapters" \
        --output "$OUTPUT_DIR/merged" \
        --quantization f16
    log_success "Birleştirme tamamlandı: $OUTPUT_DIR/merged"
}

step_4_gguf() {
    log_info "4. GGUF dönüşümü (Ollama için)..."
    python3 convert_gguf.py \
        --model "$OUTPUT_DIR/merged" \
        --output "$OUTPUT_DIR/gguf" \
        --quantization q4_k_m
    log_success "GGUF dönüşümü tamamlandı: $OUTPUT_DIR/gguf"
}

step_5_eval() {
    log_info "5. Model değerlendirme..."
    python3 eval_model.py \
        --model "$OUTPUT_DIR/lora_adapters" \
        --base_model "$MODEL" \
        --test_data "$DATA_DIR/test.jsonl" \
        --max_samples "$MAX_SAMPLES" \
        --output ./evaluation_results/eval_results.json
    log_success "Değerlendirme tamamlandı: ./evaluation_results/eval_results.json"
}

step_6_benchmark() {
    log_info "6. A/B Benchmark (Fine-tuned vs Base)..."
    python3 benchmark_vs_baseline.py \
        --fine_tuned "$OUTPUT_DIR/lora_adapters" \
        --base "$MODEL" \
        --judge "$JUDGE_MODEL" \
        --test_data "$DATA_DIR/test.jsonl" \
        --max_samples "$MAX_SAMPLES" \
        --output ./evaluation_results/benchmark_results.json
    log_success "Benchmark tamamlandı: ./evaluation_results/benchmark_results.json"
}

step_7_rag_index() {
    log_info "7. RAG index oluşturma..."
    python3 rag_pipeline.py \
        --mode index \
        --data ./datasets/raw/merinos_faq.jsonl \
        --index_dir ./rag_index
    log_success "RAG index oluşturuldu: ./rag_index"
}

step_8_ollama() {
    log_info "8. Ollama entegrasyonu..."
    if command -v ollama &> /dev/null; then
        ollama create merinos -f Modelfile
        log_success "Ollama modeli oluşturuldu: 'ollama run merinos'"
    else
        log_warn "Ollama yüklü değil. Manuel olarak:"
        log_info "  1. ollama create merinos -f Modelfile"
        log_info "  2. ollama run merinos"
    fi
}

step_9_docker() {
    log_info "9. Docker deployment..."
    if command -v docker-compose &> /dev/null; then
        docker-compose up -d
        log_success "Docker servisleri başlatıldı"
        log_info "  API: http://localhost:8000"
        log_info "  RAG: http://localhost:8001"
        log_info "  Grafana: http://localhost:3000 (admin/merinos2024)"
    else
        log_warn "Docker Compose bulunamadı"
    fi
}

# ================================================================================
# ANA AKIŞ
# ================================================================================

echo -e "${GREEN}"
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║           MERINOS FULL PIPELINE - v1.0                               ║"
echo "║           Fine-tune → Eval → Deploy                                  ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

log_info "Mod: $MODE | Model: $MODEL | Epochs: $EPOCHS | Seq: $SEQ_LENGTH"

START_TIME=$(date +%s)

case $MODE in
    all)
        step_0_prerequisites
        step_1_vram_test
        step_2_train
        step_3_merge
        step_4_gguf
        step_5_eval
        step_6_benchmark
        step_7_rag_index
        step_8_ollama
        step_9_docker
        ;;
    train)
        step_0_prerequisites
        step_1_vram_test
        step_2_train
        ;;
    eval)
        step_5_eval
        step_6_benchmark
        ;;
    deploy)
        step_3_merge
        step_4_gguf
        step_7_rag_index
        step_8_ollama
        step_9_docker
        ;;
    quick)
        # Sadece eğitim + inference testi
        step_0_prerequisites
        step_2_train
        log_info "Inference testi..."
        python3 inference.py --model "$OUTPUT_DIR/lora_adapters" --base_model "$MODEL"
        ;;
    *)
        log_error "Bilinmeyen mod: $MODE"
        echo "Kullanılabilir modlar: all, train, eval, deploy, quick"
        exit 1
        ;;
esac

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
HOURS=$((ELAPSED / 3600))
MINUTES=$(((ELAPSED % 3600) / 60))

echo -e "${GREEN}"
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║           PIPELINE TAMAMLANDI!                                       ║"
echo "║           Süre: ${HOURS}s ${MINUTES}d                                           ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

log_info "Sonraki adımlar:"
log_info "  • Inference: python3 inference.py --model $OUTPUT_DIR/lora_adapters"
log_info "  • API: python3 api_server.py --model $OUTPUT_DIR/lora_adapters"
log_info "  • RAG: python3 rag_pipeline.py --mode query --model $OUTPUT_DIR/lora_adapters"
log_info "  • Ollama: ollama run merinos"
