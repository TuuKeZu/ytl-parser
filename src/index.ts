import axios from 'axios';
import { JSDOM } from 'jsdom';

import fs from 'fs';


interface SubjectTable {
    [key: string]: Number[]
}

interface YearTable {
    year: string,
    points: SubjectTable
}

type ResultTable = {
    [key: string]: SubjectTable
}

        
const parseTable = (container: Element): SubjectTable | null => {
    const result: SubjectTable = {};
    const table = Array.from(container.getElementsByTagName('tbody')).at(0);
    if (!table) return null;
    
    table.childNodes.forEach(e => {
        const [subject, ...points] = Array.from(e.childNodes).map(c => <string>c.textContent);
        if (!subject.trim()) return
        result[subject] = points.map(p => +p);
    })

    return result
}

const getUrlMap = (): Promise<string[]> => {
    return new Promise((resolve, reject) => {
        const result = [];

        axios.get("https://www.ylioppilastutkinto.fi/fi/tutkinnon-suorittaminen/pisterajat/pisterajat-kevat-2023")
        .then(res => {
            const document = new JSDOM(res.data).window.document;

            const list = Array.from(document.getElementsByClassName("sidebar-menu__item sidebar-menu__item--active sidebar-menu__item--with-sub")).at(0);
            if (!list) return reject("Failed to parse document");

            const links = Array.from(list.getElementsByTagName('li')).map(c => Array.from(c.getElementsByTagName('a')).at(0)?.href).map(link => `https://www.ylioppilastutkinto.fi${link}`);

            return resolve(links)
        })
        .catch(err => {
            return reject(err);
        })
    });
}


const getByURL = (url: string): Promise<YearTable[]> => {
    return new Promise((resolve, reject) => {
        const result: YearTable[] = [];
        let year: string;

        axios.get(url)
        .then(res => {
            const document = new JSDOM(res.data).window.document;

            const container = Array.from(document.getElementsByClassName('text-long')).at(0);
            if (!container) return reject("Failed to parse document");


            if (container.childElementCount > 10) {
                Array.from(container.children).filter(c => c.textContent?.trim()).forEach((childContainer, i) => {
                    if (i % 2 == 0) {
                        year = (<string>childContainer.textContent).trim();
                    } else {
                        const table = parseTable(childContainer);
                        if (!table) return reject("Failed to parse table");
                        result.push(<YearTable>{year: year, points: table});
                    }
                });
            } else {
                const title = Array.from(document.getElementsByClassName('heading')).at(0);
                if (!title) return reject("Failed to parse document");
                
                const [_, ...a] = (<string>title.textContent).trim().split(' ');
                const year = a.join(' ');
                
                const table = parseTable(container);
                if (!table) return reject("Failed to parse table");
                result.push(<YearTable>{year: year, points: table});
            }

            return resolve(result);
        })
        .catch(err => {
            return reject(err);
        })
    });
}



const main = async () => {
    const result: ResultTable = {};

    const links = await getUrlMap()

    for await (const url of links) {
        const table = await getByURL(url);
        console.log(url);
        
        table.forEach(n => {
            result[n.year] = n.points;
        });
    }

    fs.writeFileSync('./out/yo-results.json', JSON.stringify(result));
    console.log("Done!");
}

main();