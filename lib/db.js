import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

// Asegurar que el directorio data existe
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

export const getFilePath = (collection) => path.join(DATA_DIR, `${collection}.json`);

export const readData = (collection) => {
    const filePath = getFilePath(collection);
    if (!fs.existsSync(filePath)) {
        return []; // Retorna array vacío si el archivo no existe
    }
    const jsonData = fs.readFileSync(filePath, 'utf8');
    try {
        return JSON.parse(jsonData);
    } catch (error) {
        return [];
    }
};

export const writeData = (collection, data) => {
    const filePath = getFilePath(collection);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
};
