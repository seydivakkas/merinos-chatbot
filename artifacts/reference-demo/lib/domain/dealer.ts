import type { Dealer } from "@/lib/types";
import { normalizeText } from "@/lib/domain/normalization";

export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function filterDealers(dealers: Dealer[], city?: string, district?: string): Dealer[] {
  const cityValue = normalizeText(city ?? "");
  const districtValue = normalizeText(district ?? "");
  return dealers
    .filter((dealer) => !cityValue || normalizeText(dealer.city) === cityValue)
    .filter((dealer) => !districtValue || normalizeText(dealer.district) === districtValue)
    .sort((a, b) => a.city.localeCompare(b.city, "tr-TR") || a.district.localeCompare(b.district, "tr-TR"));
}

export function sortDealersByLocation(dealers: Dealer[], latitude: number, longitude: number): Dealer[] {
  return dealers
    .map((dealer) => ({ ...dealer, approximateDistanceKm: Number(haversineDistanceKm(latitude, longitude, dealer.latitude, dealer.longitude).toFixed(1)) }))
    .sort((a, b) => (a.approximateDistanceKm ?? Infinity) - (b.approximateDistanceKm ?? Infinity) || a.id.localeCompare(b.id));
}
