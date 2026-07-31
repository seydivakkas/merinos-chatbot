import rawData from "@/shared/demo-data.json";
import type { Dealer, DemoOrder, Faq, Product } from "@/lib/types";

type DemoData = {
  schemaVersion: string;
  generatedAt: string;
  products: Product[];
  orders: DemoOrder[];
  dealers: Dealer[];
  faqs: Faq[];
};

export const demoData = rawData as DemoData;
export const products = demoData.products;
export const orders = demoData.orders;
export const dealers = demoData.dealers;
export const faqs = demoData.faqs.filter((faq) => faq.status === "published");
export const demoCities = [...new Set(dealers.map((dealer) => dealer.city))].sort((a, b) => a.localeCompare(b, "tr-TR"));
export const demoMetadata = { schemaVersion: demoData.schemaVersion, generatedAt: demoData.generatedAt };
