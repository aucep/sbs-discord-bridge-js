import { readFileSync } from 'fs';
import { writeFile } from 'fs/promises';

// read
export function readConf(path: string): any {
    let data = JSON.parse(readFileSync(`${path}.json`).toString());
    if (data instanceof Array) data = new Map(data);
    console.log(`readConf ${path} ->`, data);
    return data;
}

// write
export async function writeConf(path: string, data: any) {
    console.log(`writeConf ${path} <-`, data);
    if (data instanceof Map) data = Array.from(data.entries());
    await writeFile(`${path}.json`, JSON.stringify(data));
}
