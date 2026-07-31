// Calisma takvimi motoru: SLA hesaplamasina resmi tatil / mesai saati /
// bolgesel takvim entegrasyonu.
//
// Onceki basit SLA modeli (bkz. slaEngine.ts) hedef sureyi ham takvim
// dakikasi olarak ekliyordu (7/24 akiyormus gibi). Bu modul, "is gunu +
// mesai saati" farkindaligiyla hedef tarihleri hesaplayan bir motor sunar:
// hafta sonlari, resmi/dini tatiller ve mesai saatleri disinda gecen sure
// SLA suresinden dusulmez (saat calismiyor).
//
// Turkiye 2016'dan beri yaz saati uygulamasini kaldirdi ve sabit UTC+3
// kullaniyor; bu yuzden IANA zaman dilimi veritabanina ihtiyac duymadan sabit
// bir ofsetle guvenilir sekilde hesaplama yapilabilir.

export type RegionCode = "TR" | "TR-ISTANBUL" | "TR-ANKARA"

type WorkCalendarConfig = {
	// Dakika cinsinden UTC ofseti (Turkiye icin sabit +180, DST yok).
	utcOffsetMinutes: number
	// 0=Pazar ... 6=Cumartesi (JS Date.getUTCDay konvansiyonu).
	workingWeekdays: number[]
	businessStartHour: number
	businessStartMinute: number
	businessEndHour: number
	businessEndMinute: number
	// Tam gun tatiller, "YYYY-MM-DD" (bolge yerel takvim gunu).
	holidays: Set<string>
}

// NOT: Dini bayramlarin (Ramazan/Kurban Bayrami) tarihleri hicri takvime
// gore degisir. 2025 tarihleri resmi/kesin, 2026 tarihleri Diyanet'in yayimi
// oncesi tahmini degerlerdir; prodüksiyonda resmi takvimle guncellenmelidir.
const TR_HOLIDAYS_2025_2026 = [
	"2025-01-01", // Yilbasi
	"2025-03-30",
	"2025-03-31",
	"2025-04-01", // Ramazan Bayrami (resmi 3 gun)
	"2025-04-23", // Ulusal Egemenlik ve Cocuk Bayrami
	"2025-05-01", // Emek ve Dayanisma Gunu
	"2025-05-19", // Ataturk'u Anma Genclik ve Spor Bayrami
	"2025-06-06",
	"2025-06-07",
	"2025-06-08",
	"2025-06-09", // Kurban Bayrami (resmi 4 gun)
	"2025-07-15", // Demokrasi ve Milli Birlik Gunu
	"2025-08-30", // Zafer Bayrami
	"2025-10-29", // Cumhuriyet Bayrami
	"2026-01-01",
	"2026-03-19",
	"2026-03-20",
	"2026-03-21", // Ramazan Bayrami (tahmini)
	"2026-04-23",
	"2026-05-01",
	"2026-05-19",
	"2026-05-26",
	"2026-05-27",
	"2026-05-28",
	"2026-05-29", // Kurban Bayrami (tahmini)
	"2026-07-15",
	"2026-08-30",
	"2026-10-29",
]

function defaultTrCalendar(): WorkCalendarConfig {
	return {
		utcOffsetMinutes: 180,
		workingWeekdays: [1, 2, 3, 4, 5], // Pazartesi-Cuma
		businessStartHour: 9,
		businessStartMinute: 0,
		businessEndHour: 18,
		businessEndMinute: 0,
		holidays: new Set(TR_HOLIDAYS_2025_2026),
	}
}

// Bolgesel takvim kaydi: mimari olarak her bolge/il icin farkli mesai
// saatleri veya tatil listesi tanimlanabilir. Su an tum TR bolgeleri ayni
// ulusal takvimi kullanir; ileride ör. "TR-ISTANBUL" icin yerel bir tatil
// eklenmek istenirse sadece asagidaki map'e girdi eklemek yeterlidir.
const WORK_CALENDARS: Record<RegionCode, WorkCalendarConfig> = {
	TR: defaultTrCalendar(),
	"TR-ISTANBUL": defaultTrCalendar(),
	"TR-ANKARA": defaultTrCalendar(),
}

function getCalendar(region: RegionCode): WorkCalendarConfig {
	return WORK_CALENDARS[region] ?? WORK_CALENDARS.TR
}

type LocalParts = { y: number; m: number; d: number; hour: number; minute: number; weekday: number; dateKey: string }

function toLocalParts(date: Date, cal: WorkCalendarConfig): LocalParts {
	const shifted = new Date(date.getTime() + cal.utcOffsetMinutes * 60_000)
	const y = shifted.getUTCFullYear()
	const m = shifted.getUTCMonth()
	const d = shifted.getUTCDate()
	const dateKey = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
	return {
		y,
		m,
		d,
		hour: shifted.getUTCHours(),
		minute: shifted.getUTCMinutes(),
		weekday: shifted.getUTCDay(),
		dateKey,
	}
}

function fromLocalYMDHM(y: number, m: number, d: number, hour: number, minute: number, cal: WorkCalendarConfig): Date {
	const utcMs = Date.UTC(y, m, d, hour, minute, 0, 0) - cal.utcOffsetMinutes * 60_000
	return new Date(utcMs)
}

function isWorkingCalendarDay(parts: LocalParts, cal: WorkCalendarConfig): boolean {
	if (!cal.workingWeekdays.includes(parts.weekday)) return false
	if (cal.holidays.has(parts.dateKey)) return false
	return true
}

export function isHoliday(date: Date, region: RegionCode = "TR"): boolean {
	const cal = getCalendar(region)
	return cal.holidays.has(toLocalParts(date, cal).dateKey)
}

export function isBusinessMoment(date: Date, region: RegionCode = "TR"): boolean {
	const cal = getCalendar(region)
	const parts = toLocalParts(date, cal)
	if (!isWorkingCalendarDay(parts, cal)) return false
	const startMinutes = cal.businessStartHour * 60 + cal.businessStartMinute
	const endMinutes = cal.businessEndHour * 60 + cal.businessEndMinute
	const nowMinutes = parts.hour * 60 + parts.minute
	return nowMinutes >= startMinutes && nowMinutes < endMinutes
}

// Verilen andan itibaren (dahil) bir sonraki calisma anini dondurur; verilen
// an zaten mesai icindeyse oldugu gibi doner.
export function nextBusinessMoment(date: Date, region: RegionCode = "TR"): Date {
	const cal = getCalendar(region)
	let parts = toLocalParts(date, cal)
	for (let guard = 0; guard < 400; guard++) {
		if (isWorkingCalendarDay(parts, cal)) {
			const startMinutes = cal.businessStartHour * 60 + cal.businessStartMinute
			const endMinutes = cal.businessEndHour * 60 + cal.businessEndMinute
			const nowMinutes = parts.hour * 60 + parts.minute
			if (nowMinutes < startMinutes) {
				return fromLocalYMDHM(parts.y, parts.m, parts.d, cal.businessStartHour, cal.businessStartMinute, cal)
			}
			if (nowMinutes < endMinutes) {
				return fromLocalYMDHM(parts.y, parts.m, parts.d, parts.hour, parts.minute, cal)
			}
			// mesai bitmis, ertesi gune gec
		}
		// bir sonraki takvim gunune gec (yerel saat 00:00)
		const nextDay = fromLocalYMDHM(parts.y, parts.m, parts.d, 0, 0, cal)
		const nextDayPlus = new Date(nextDay.getTime() + 24 * 60 * 60_000)
		parts = toLocalParts(nextDayPlus, cal)
	}
	throw new Error("work_calendar_no_business_day_found")
}

// SLA motorunun kalbi: "start" anindan itibaren, sadece is gunu + mesai
// saatleri icinde gecen dakikalari sayarak "minutes" is dakikasi sonraki
// gercek takvim anini dondurur. Hafta sonu/tatil/mesai disi sureler SLA
// suresinden dusulmez.
export function addBusinessMinutes(start: Date, minutes: number, region: RegionCode = "TR"): Date {
	const cal = getCalendar(region)
	let cursor = nextBusinessMoment(start, region)
	let remaining = minutes
	for (let guard = 0; guard < 4000 && remaining > 0; guard++) {
		const parts = toLocalParts(cursor, cal)
		const dayEnd = fromLocalYMDHM(parts.y, parts.m, parts.d, cal.businessEndHour, cal.businessEndMinute, cal)
		const availableMinutes = (dayEnd.getTime() - cursor.getTime()) / 60_000
		if (remaining <= availableMinutes) {
			return new Date(cursor.getTime() + remaining * 60_000)
		}
		remaining -= availableMinutes
		// ertesi is gununun mesai baslangicina atla
		const afterDayEnd = new Date(dayEnd.getTime() + 60_000)
		cursor = nextBusinessMoment(afterDayEnd, region)
	}
	if (remaining > 0) throw new Error("work_calendar_could_not_resolve_due_date")
	return cursor
}

export function listHolidays(region: RegionCode = "TR"): string[] {
	return [...getCalendar(region).holidays].sort()
}
