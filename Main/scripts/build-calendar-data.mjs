import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const eventsDir = path.join(rootDir, "node_modules/nepali-calendar-toolkit/dist/data/Events");
const detailsDir = path.join(rootDir, "node_modules/nepali-calendar-toolkit/dist/data/DayDetails");

const tithiNames = [
  "", "प्रतिपदा", "द्वितीया", "तृतीया", "चतुर्थी", "पञ्चमी",
  "षष्ठी", "सप्तमी", "अष्टमी", "नवमी", "दशमी",
  "एकादशी", "द्वादशी", "त्रयोदशी", "चतुर्दशी", "पूर्णिमा"
];

const calendarData = {};

for (let y = 2065; y <= 2084; y++) {
  const evFile = path.join(eventsDir, `${y}.json`);
  const dtFile = path.join(detailsDir, `${y}.json`);

  const events = fs.existsSync(evFile) ? JSON.parse(fs.readFileSync(evFile, "utf8")) : [];
  const details = fs.existsSync(dtFile) ? JSON.parse(fs.readFileSync(dtFile, "utf8")) : [];

  if (!events.length && !details.length) continue;

  calendarData[y] = {};

  for (const item of details) {
    const m = item.bsMonth;
    const d = item.bsDay;
    if (!calendarData[y][m]) calendarData[y][m] = {};

    let tithiStr = "";
    if (item.tithi === 30) tithiStr = "औंसी";
    else if (item.tithi >= 1 && item.tithi <= 15) tithiStr = tithiNames[item.tithi] || "";

    calendarData[y][m][d] = {
      t: tithiStr,
      h: [],
      e: [],
      isH: false
    };
  }

  for (const ev of events) {
    const m = ev.bsMonth;
    const d = ev.bsDay;
    if (!calendarData[y][m]) calendarData[y][m] = {};
    if (!calendarData[y][m][d]) {
      calendarData[y][m][d] = { t: "", h: [], e: [], isH: false };
    }

    const entry = calendarData[y][m][d];
    const name = ev.nameNe?.trim();
    if (!name) continue;

    if (ev.isGovernmentHoliday) {
      entry.isH = true;
      if (!entry.h.includes(name)) entry.h.push(name);
    } else {
      if (!entry.e.includes(name)) entry.e.push(name);
    }
  }
}

const outputPath = path.join(rootDir, "src/nepal-calendar-data.json");
fs.writeFileSync(outputPath, JSON.stringify(calendarData));
console.log(`Successfully generated ${outputPath}: ${Math.round(fs.statSync(outputPath).size / 1024)} KB`);