// El yapimi hafif semâ dogrulayici (zod/ajv paket erisimi sandbox'ta yok;
// disariya bagimliligi olmayan, kucuk ama gercek bir dogrulama katmani).
//
// Amac: API sertlestirme kapsaminda POST govdelerini kabul etmeden once
// tip/zorunluluk/format acisindan dogrulamak (schema validation).

export type FieldSchema =
	| { type: "string"; required?: boolean; minLength?: number; maxLength?: number; enum?: string[]; pattern?: RegExp }
	| { type: "number"; required?: boolean; min?: number; max?: number }
	| { type: "boolean"; required?: boolean }
	| { type: "object"; required?: boolean }
	| { type: "array"; required?: boolean; items?: "string" | "number" | "object" }

// ObjectSchema: rota basina alan tanimlari "fields" altinda gruplanir.
// strict=true ise, semada tanimlanmamis fazladan alanlar da hataya sebep olur
// (varsayilan: fazladan alanlara izin verilir, sadece bilinen alanlar
// dogrulanir).
export type ObjectSchema = {
	fields: Record<string, FieldSchema>
	strict?: boolean
}

export type ValidationError = { field: string; message: string }

export type ValidationResult =
	| { ok: true; value: Record<string, unknown> }
	| { ok: false; errors: ValidationError[] }

function typeOf(value: unknown): string {
	if (value === null) return "null"
	if (Array.isArray(value)) return "array"
	return typeof value
}

export function validateBody(body: unknown, schema: ObjectSchema, basePath = ""): ValidationResult {
	const errors: ValidationError[] = []
	if (typeOf(body) !== "object") {
		return { ok: false, errors: [{ field: basePath || "$", message: "body must be a JSON object" }] }
	}
	const obj = body as Record<string, unknown>

	for (const [field, fieldSchema] of Object.entries(schema.fields)) {
		const value = obj[field]
		const present = value !== undefined && value !== null
		const fieldPath = basePath ? `${basePath}.${field}` : field

		if (!present) {
			if (fieldSchema.required) errors.push({ field: fieldPath, message: "required" })
			continue
		}

		switch (fieldSchema.type) {
			case "string": {
				if (typeof value !== "string") {
					errors.push({ field: fieldPath, message: "must be a string" })
					break
				}
				if (fieldSchema.minLength !== undefined && value.length < fieldSchema.minLength) {
					errors.push({ field: fieldPath, message: `must have length >= ${fieldSchema.minLength}` })
				}
				if (fieldSchema.maxLength !== undefined && value.length > fieldSchema.maxLength) {
					errors.push({ field: fieldPath, message: `must have length <= ${fieldSchema.maxLength}` })
				}
				if (fieldSchema.enum && !fieldSchema.enum.includes(value)) {
					errors.push({ field: fieldPath, message: `must be one of: ${fieldSchema.enum.join(", ")}` })
				}
				if (fieldSchema.pattern && !fieldSchema.pattern.test(value)) {
					errors.push({ field: fieldPath, message: "does not match required pattern" })
				}
				break
			}
			case "number": {
				if (typeof value !== "number" || Number.isNaN(value)) {
					errors.push({ field: fieldPath, message: "must be a number" })
					break
				}
				if (fieldSchema.min !== undefined && value < fieldSchema.min) {
					errors.push({ field: fieldPath, message: `must be >= ${fieldSchema.min}` })
				}
				if (fieldSchema.max !== undefined && value > fieldSchema.max) {
					errors.push({ field: fieldPath, message: `must be <= ${fieldSchema.max}` })
				}
				break
			}
			case "boolean": {
				if (typeof value !== "boolean") errors.push({ field: fieldPath, message: "must be a boolean" })
				break
			}
			case "object": {
				if (typeOf(value) !== "object") errors.push({ field: fieldPath, message: "must be an object" })
				break
			}
			case "array": {
				if (!Array.isArray(value)) {
					errors.push({ field: fieldPath, message: "must be an array" })
					break
				}
				if (fieldSchema.items) {
					const badIdx = value.findIndex((v) => typeOf(v) !== fieldSchema.items)
					if (badIdx !== -1) errors.push({ field: fieldPath, message: `item[${badIdx}] must be ${fieldSchema.items}` })
				}
				break
			}
		}
	}

	if (schema.strict) {
		const knownFields = new Set(Object.keys(schema.fields))
		for (const key of Object.keys(obj)) {
			if (!knownFields.has(key)) {
				const fieldPath = basePath ? `${basePath}.${key}` : key
				errors.push({ field: fieldPath, message: "unknown field not allowed (strict schema)" })
			}
		}
	}

	if (errors.length > 0) return { ok: false, errors }
	return { ok: true, value: obj }
}
