import fs from "fs";
import path from "path";

import * as osmosisPixel from "./osmosis_pixel";

type ArtData = {
    viewport: {
        x: number;
        y: number;
    };
    pixels: number[][];
};

const { viewport, pixels }: ArtData = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../data/tedcrypto.json"), "utf8")
);

const ORIGIN = [71, 71];
const START = [0, 0];

(async function() {
    let number_changes = 0;
    for (let i = START[0]; i < viewport.y; i++) {
        for (let j = START[1]; j < viewport.x; j++) {
            const y = ORIGIN[0] + i - 1;
            const x = ORIGIN[1] + j - 1;
            const color = pixels[i][j];
            if (!await osmosisPixel.isColor({'x': x.toString(), 'y': y.toString()}, color)) {
                console.log("Pixel " + x + "," + y + " is not " + color);
                console.log('https://app.osmosis.zone/pixels?x='+(x + 1)+'&y='+(y + 1)+'&color='+color);
                number_changes++;
            }
        }
    }

    console.log('Is necessary ' + number_changes + ' changes. AVG: ' + (number_changes*1.5) + ' minutes');
})()