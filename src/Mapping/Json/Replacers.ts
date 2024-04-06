export function pascalCaseReplacer(key, value) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
        const replacement = {};
        for (const k in value) {
            if (Object.hasOwnProperty.call(value, k)) {
                replacement[k && k.charAt(0).toUpperCase() + k.slice(1)] = value[k];
            }
        }
        return replacement;
    }

    return value;
}

export function camelCaseReplacer(key, value) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
        const replacement = {};
        for (const k in value) {
            if (Object.hasOwnProperty.call(value, k)) {
                replacement[k && k.charAt(0).toLowerCase() + k.slice(1)] = value[k];
            }
        }

        return replacement;
    }

    return value;
}
