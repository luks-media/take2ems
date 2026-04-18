const fs = require('fs');

let f2 = fs.readFileSync('src/components/equipment/NewEquipmentDialog.tsx', 'utf-8');
const idx2 = f2.indexOf('  )\n}\n    <Button type="submit"');
if (idx2 !== -1) {
  fs.writeFileSync('src/components/equipment/NewEquipmentDialog.tsx', f2.substring(0, idx2 + 5));
}
