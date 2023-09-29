import axios from 'axios';
import { JSDOM } from 'jsdom';

import fs from 'fs';


interface SubjectTable {
    [key: string]: Number[]
}


interface YearTable {
    [key: string]: Number[]
}

interface YearEntry {
    year: string,
    points: SubjectTable
}

type YearResultTable = {
    [key: string]: SubjectTable
}

type SubjectResultTable = {
    [key: string]: YearTable
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


const getByYear = (url: string): Promise<YearEntry[]> => {
    return new Promise((resolve, reject) => {
        const result: YearEntry[] = [];
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
                        result.push(<YearEntry>{year: year, points: table});
                    }
                });
            } else {
                const title = Array.from(document.getElementsByClassName('heading')).at(0);
                if (!title) return reject("Failed to parse document");
                
                const [_, ...a] = (<string>title.textContent).trim().split(' ');
                const year = a.join(' ');
                
                const table = parseTable(container);
                if (!table) return reject("Failed to parse table");
                result.push(<YearEntry>{year: year, points: table});
            }

            return resolve(result);
        })
        .catch(err => {
            return reject(err);
        })
    });
}



const main = async () => {
    const result: YearResultTable = {};
    const result2: SubjectResultTable = {};

    const links = await getUrlMap()

    for await (const url of links) {
        const table = await getByYear(url);
        
        table.forEach(e => {
            
            Object.keys(e.points).forEach(subject => {
                const points = e.points[subject];

                if (!result2[subject]) result2[subject] = { [e.year]: points };
                result2[subject][e.year] = points;
            });
            
            result[e.year] = e.points;
        });
    }

    fs.writeFileSync('./out/yo-results.json', JSON.stringify(result));
    fs.writeFileSync('./out/yo-results-subject.json', JSON.stringify(result2));
    console.log("Done!");
}

main();