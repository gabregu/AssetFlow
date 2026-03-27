const cleanText = (text) => {
    if (!text) return '';
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Quita acentos
        .replace(/\u00f1/g, 'n') // ñ -> n
        .replace(/\u00d1/g, 'N'); // Ñ -> N
};

const input = "Avenida Andrés Bello";
const output = cleanText(input);
console.log(`Input: ${input}`);
console.log(`Output: ${output}`);
if (output === "Avenida Andres Bello") {
    console.log("Success!");
} else {
    console.log("Failure!");
}
