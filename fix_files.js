const fs = require('fs');

let f1 = fs.readFileSync('src/components/equipment/EditEquipmentForm.tsx', 'utf-8');
const idx1 = f1.indexOf('  )\n}\nnt="outline"');
if (idx1 !== -1) {
  fs.writeFileSync('src/components/equipment/EditEquipmentForm.tsx', f1.substring(0, idx1 + 5));
}

let f2 = fs.readFileSync('src/components/equipment/NewEquipmentDialog.tsx', 'utf-8');
const idx2 = f2.indexOf('  )\n}\n                       />');
if (idx2 !== -1) {
  fs.writeFileSync('src/components/equipment/NewEquipmentDialog.tsx', f2.substring(0, idx2 + 5));
}
