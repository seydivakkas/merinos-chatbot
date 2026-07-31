import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig, Trainer, TrainingArguments, DataCollatorForLanguageModeling
from peft import LoraConfig, get_peft_model
from datasets import Dataset

model_id = "unsloth/Qwen2.5-7B-Instruct-bnb-4bit"
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.float16,
    bnb_4bit_use_double_quant=True,
)

tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

model = AutoModelForCausalLM.from_pretrained(
    model_id,
    quantization_config=bnb_config,
    device_map="auto",
    trust_remote_code=True
)

peft_config = LoraConfig(
    r=16,
    lora_alpha=32,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM",
)

model = get_peft_model(model, peft_config)

dummy_texts = ["<|im_start|>user\nMerhaba Merinos Halı bilgi alabilir miyim?<|im_end|>\n<|im_start|>assistant\nMerhaba, ben Merinos Müşteri Temsilcisi Meri. Size nasıl yardımcı olabilirim?<|im_end|>"] * 10
inputs = tokenizer(dummy_texts, max_length=512, truncation=True, padding="max_length", return_tensors="pt")
dataset = Dataset.from_dict({"input_ids": inputs["input_ids"], "attention_mask": inputs["attention_mask"], "labels": inputs["input_ids"]})

training_args = TrainingArguments(
    output_dir="./test_output",
    num_train_epochs=1,
    per_device_train_batch_size=1,
    gradient_accumulation_steps=2,
    learning_rate=2e-4,
    fp16=False,
    bf16=False,
    gradient_checkpointing=True,
    report_to="none",
    max_steps=2,
)

trainer = Trainer(
    model=model,
    train_dataset=dataset,
    args=training_args,
    data_collator=DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False),
)

print("Starting standard Trainer.train()...")
trainer.train()
print("🎉 Standard Trainer test successful! Peak VRAM:", torch.cuda.max_memory_allocated() / 1024**3, "GB")
