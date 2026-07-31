"use client";

import { useEffect, useMemo, useState } from "react";
import { Chatbot } from "@/components/Chatbot";
import { DealerMap } from "@/components/DealerMap";
import { ProductVisual } from "@/components/ProductVisual";
import { createRepositories } from "@/lib/data/repository-factory";
import { useExperience } from "@/lib/state/ExperienceContext";
import type { Dealer, Faq, Product } from "@/lib/types";

function formatPrice(price: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(price);
}

export default function Home() {
  const repositories = useMemo(() => createRepositories(), []);
  const { state, dispatch } = useExperience();
  const [menuOpen, setMenuOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [facets, setFacets] = useState({ categories: [] as string[], colors: [] as string[], sizes: [] as string[], collections: [] as string[] });
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);

  const category = state.productCriteria.categories?.[0] ?? "Tümü";
  const color = state.productCriteria.colors?.[0] ?? "Tümü";
  const size = state.productCriteria.sizes?.[0] ?? "Tümü";

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([repositories.products.facets(controller.signal), repositories.knowledge.list(controller.signal)])
      .then(([facetResult, faqResult]) => {
        if (facetResult.ok) setFacets(facetResult.data); else setDataError(facetResult.error.message);
        if (faqResult.ok) setFaqs(faqResult.data);
      });
    return () => controller.abort();
  }, [repositories]);

  useEffect(() => {
    const controller = new AbortController();
    setLoadingProducts(true); setDataError(null);
    void repositories.products.search({ ...state.productCriteria, limit: 24 }, controller.signal).then((result) => {
      if (result.ok) setProducts(result.data.items); else setDataError(result.error.message);
      setLoadingProducts(false);
    });
    return () => controller.abort();
  }, [repositories, state.productCriteria]);

  useEffect(() => {
    const controller = new AbortController();
    void repositories.dealers.search({ city: state.dealerCity }, controller.signal).then((result) => {
      if (!result.ok) { setDataError(result.error.message); return; }
      setDealers(result.data);
      dispatch({ type: "SELECT_DEALER", dealerId: result.data[0]?.id ?? "" });
    });
    return () => controller.abort();
  }, [dispatch, repositories, state.dealerCity]);

  const selectedDealer = dealers.find((dealer) => dealer.id === state.selectedDealerId) ?? dealers[0];
  const demoCities = useMemo(() => ["Gaziantep", "İstanbul", "Ankara", "Bursa"], []);
  const openChat = (command?: string) => dispatch({ type: "OPEN_CHAT", command });
  const setFilter = (key: "categories" | "colors" | "sizes", value: string) => dispatch({ type: "SET_PRODUCT_CRITERIA", criteria: { ...state.productCriteria, [key]: value === "Tümü" ? [] : [value] } });
  const resetFilters = () => dispatch({ type: "SET_PRODUCT_CRITERIA", criteria: {} });

  const useLocation = () => {
    if (!navigator.geolocation) { setLocationStatus("Tarayıcınız konum özelliğini desteklemiyor. Şehir seçimini kullanın."); return; }
    setLocationStatus("Konum izni bekleniyor…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const controller = new AbortController();
        void repositories.dealers.search({ latitude: position.coords.latitude, longitude: position.coords.longitude, limit: 6 }, controller.signal).then((result) => {
          if (!result.ok) { setLocationStatus(result.error.message); return; }
          setDealers(result.data); if (result.data[0]) dispatch({ type: "SELECT_DEALER", dealerId: result.data[0].id });
          setLocationStatus("Yaklaşık mesafe, yalnız bu ekran için demo koordinatlarıyla hesaplandı.");
        });
      },
      () => setLocationStatus("Konum izni verilmedi. Şehir veya ilçe seçerek devam edebilirsiniz."),
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 0 },
    );
  };

  return (
    <main>
      <div className="demo-strip"><span>DEMO ORTAMI</span>Ürün, fiyat, stok, bayi ve sipariş bilgileri tamamen temsilidir.</div>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Merinos demo ana sayfa"><span className="brand-mark" aria-hidden="true">M</span><span><strong>MERINOS</strong><small>HALI · DEMO</small></span></a>
        <nav className={menuOpen ? "mobile-open" : ""} aria-label="Ana menü"><a href="#collections" onClick={() => setMenuOpen(false)}>Koleksiyonlar</a><a href="#products" onClick={() => setMenuOpen(false)}>Ürünler</a><a href="#dealers" onClick={() => setMenuOpen(false)}>Satış Noktaları</a><a href="#faq" onClick={() => setMenuOpen(false)}>SSS</a><a href="/admin">Yönetim</a></nav>
        <div className="header-actions"><button type="button" className="icon-button" aria-label="Dijital asistanla ürün ara" onClick={() => openChat()}>⌕</button><span className="language-button" aria-label="Geçerli dil Türkçe">TR</span><button type="button" className={`menu-button ${menuOpen ? "active" : ""}`} aria-label={menuOpen ? "Menüyü kapat" : "Menüyü aç"} aria-expanded={menuOpen} onClick={() => setMenuOpen((current) => !current)}><span /><span /></button></div>
      </header>

      <section className="hero" id="top"><div className="hero-copy"><p className="eyebrow">MERİNOS DİJİTAL DENEYİM</p><h1>Yaşam alanınıza<span>dokunan desenler.</span></h1><p className="hero-description">Kategori, renk ve ölçüyle ürün keşfedin. Dijital asistandan öneri alın, sentetik sipariş durumunu takip edin veya satış noktalarını görüntüleyin.</p><div className="hero-actions"><a className="primary-button" href="#products">Koleksiyonu keşfet <span aria-hidden="true">→</span></a><button type="button" className="text-button" onClick={() => openChat()}>Asistana sor</button></div><div className="hero-stat" aria-label="Demo özellik özeti"><strong>4</strong><span>Temel işlem akışı</span><i /><strong>2</strong><span>Local / API veri modu</span></div></div><div className="hero-art" aria-label="Temsili halı kompozisyonu"><div className="hero-circle" /><div className="hero-rug pattern-elegance"><span>Elegance</span></div><div className="hero-card"><span>DİJİTAL ASİSTAN</span><strong>Doğru halıyı birlikte bulalım</strong></div><div className="hero-index">DEMO / FINAL</div></div></section>

      <section className="trust-row" aria-label="Dijital asistan yetenekleri"><div><span className="trust-icon" aria-hidden="true">◇</span><p><strong>Akıllı ürün bulma</strong>AND/OR facet ve deterministik sıralama</p></div><div><span className="trust-icon" aria-hidden="true">□</span><p><strong>Güvenli sipariş görünümü</strong>Kesin numara eşleşmesi ve maskeli takip kodu</p></div><div><span className="trust-icon" aria-hidden="true">⌖</span><p><strong>Satış noktası bulma</strong>İzinli yaklaşık mesafe veya şehir seçimi</p></div></section>

      <section className="collections-section" id="collections"><div className="section-heading"><div><p className="eyebrow">SEÇKİLER</p><h2>Öne çıkan koleksiyonlar</h2></div><a href="#products">Tümünü gör →</a></div><div className="collection-grid">{[["Elegance","Zamansız ve rafine","collection-one"],["Therapy","Yumuşak ve huzurlu","collection-two"],["Rodin","Güçlü ve modern","collection-three"]].map(([name, description, className], index) => <article className={`collection-card ${className}`} key={name}><span>0{index + 1}</span><div><h3>{name}</h3><p>{description}</p></div><button type="button" onClick={() => { dispatch({ type: "SET_PRODUCT_CRITERIA", criteria: { collections: [name] } }); document.getElementById("products")?.scrollIntoView({ behavior: "smooth" }); }} aria-label={`${name} koleksiyonunu filtrele`}>↗</button></article>)}</div></section>

      <section className="products-section" id="products"><div className="section-heading"><div><p className="eyebrow">ÜRÜN KATALOĞU</p><h2>Alanınıza uygun halıyı bulun</h2></div><p className="result-count" aria-live="polite">{loadingProducts ? "Yükleniyor…" : `${products.length} demo ürün`}</p></div>
        <div className="filter-bar"><label>Kategori<select value={category} onChange={(event) => setFilter("categories", event.target.value)}><option>Tümü</option>{facets.categories.map((item) => <option key={item}>{item}</option>)}</select></label><label>Renk<select value={color} onChange={(event) => setFilter("colors", event.target.value)}><option>Tümü</option>{facets.colors.map((item) => <option key={item}>{item}</option>)}</select></label><label>Ölçü<select value={size} onChange={(event) => setFilter("sizes", event.target.value)}><option>Tümü</option>{facets.sizes.map((item) => <option key={item}>{item}</option>)}</select></label><button type="button" className="reset-button" onClick={resetFilters}>Filtreleri temizle</button></div>
        {dataError && <div className="data-error" role="alert">{dataError}</div>}
        {!loadingProducts && products.length > 0 ? <div className="product-grid">{products.map((product) => <article className="product-card" key={product.id}><ProductVisual product={product} /><div className="product-card-body"><div className="product-meta"><span>{product.collection}</span><span className={product.stock === "Stokta" ? "in-stock" : "low-stock"}>{product.stock}</span></div><h3>{product.name}</h3><p>{product.color} · {product.size} · {product.category}</p><div className="product-price"><strong>{formatPrice(product.price)}</strong><button type="button" onClick={() => openChat(`${product.name} hakkında bilgi ver`)}>Asistana sor</button></div></div></article>)}</div> : !loadingProducts && <div className="empty-state"><span aria-hidden="true">⌕</span><h3>Bu filtrelerde ürün bulunamadı</h3><p>Filtreleri tek tek kaldırın veya asistandan yeni arama isteyin.</p><button type="button" onClick={() => openChat(`${color !== "Tümü" ? color : ""} ${size !== "Tümü" ? size : ""} ${category !== "Tümü" ? category : "halı"} arıyorum`)}>Asistana sor</button></div>}
      </section>

      <section className="story-section" id="story"><div className="story-pattern pattern-valeria" /><div><p className="eyebrow">UYGULANMIŞ FİNAL MİMARİ</p><h2>Frontend, FastAPI, Redis ve Supervisor–Worker tek pakette.</h2><p>Local mod bağımsız çalışır. API modu aynı typed sözleşmeler üzerinden FastAPI ve LangGraph katmanına bağlanır; API hatasında sessiz fixture fallback yapılmaz.</p><button type="button" onClick={() => openChat("Krem 160x230 halı bul ve Gaziantep bayilerini göster")}>Çoklu akışı dene →</button></div></section>

      <section className="dealer-section" id="dealers"><div><p className="eyebrow">SATIŞ NOKTALARI</p><h2>Size en yakın demo Merinos deneyimi.</h2><p>Şehir seçin veya açık izin vererek yaklaşık mesafeyi yalnız bu ekran için hesaplayın.</p><div className="city-tabs" aria-label="Demo şehir seçimi">{demoCities.map((city) => <button type="button" className={state.dealerCity === city ? "selected" : ""} key={city} onClick={() => dispatch({ type: "SET_DEALER_CITY", city })}>{city}</button>)}</div><button type="button" className="dealer-chat-button" onClick={useLocation}>Konumumu geçici kullan</button>{locationStatus && <p className="location-status" aria-live="polite">{locationStatus}</p>}{selectedDealer && <div className="selected-dealer-summary" aria-live="polite"><strong>{selectedDealer.name}</strong><span>{selectedDealer.district} · {selectedDealer.approximateDistanceKm != null ? `yaklaşık ${selectedDealer.approximateDistanceKm} km` : selectedDealer.distance}</span><small>{selectedDealer.hours} · {selectedDealer.phone}</small></div>}<button type="button" className="dealer-chat-button" onClick={() => openChat(`${state.dealerCity} bayilerini göster`)}>Dijital asistanla bayi bul</button></div><DealerMap dealers={dealers} selectedId={selectedDealer?.id} onSelect={(dealer) => dispatch({ type: "SELECT_DEALER", dealerId: dealer.id })} /></section>

      <section className="faq-section" id="faq"><div className="section-heading"><div><p className="eyebrow">BİLGİ BANKASI</p><h2>Sık sorulan sorular</h2></div><button type="button" onClick={() => openChat("Sık sorulan sorular")}>Asistana başka bir soru sor →</button></div><div className="faq-grid">{faqs.slice(0, 4).map((faq, index) => <details key={faq.id}><summary><span>0{index + 1}</span>{faq.question}<i aria-hidden="true">+</i></summary><p>{faq.answer}</p><small>{faq.source} · {faq.contentVersion}</small></details>)}</div></section>

      <footer><a className="brand footer-brand" href="#top"><span className="brand-mark" aria-hidden="true">M</span><span><strong>MERINOS</strong><small>CHATBOT DEMO</small></span></a><p>Yerel geliştirme prototipi · Gerçek müşteri verisi içermez.</p><div><a href="#products">Ürünler</a><a href="#dealers">Satış Noktaları</a><a href="#faq">SSS</a><a href="/admin">Yönetim</a></div></footer>
      <Chatbot open={state.chatOpen} onOpen={() => dispatch({ type: "OPEN_CHAT" })} onClose={() => dispatch({ type: "CLOSE_CHAT" })} />
    </main>
  );
}
