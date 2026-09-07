const { app } = require('electron');
const path = require('path');
const { initDatabase } = require('./src/main/database');

app.whenReady().then(() => {
  const targetPath = path.join(process.env.APPDATA, 'offline-crm-app', 'backups', 'main.db');
  const db = initDatabase(targetPath);
  const rows = db.prepare('SELECT id, name, phone, report_pdf_path, report_excel_path FROM customers WHERE report_pdf_path IS NOT NULL OR report_excel_path IS NOT NULL').all();
  console.log('=== CUSTOMERS WITH REPORT PATHS (' + rows.length + ') ===');
  rows.forEach(r => {
    console.log(`ID: ${r.id}, Name: ${r.name}, PDF: ${r.report_pdf_path}, Excel: ${r.report_excel_path}`);
  });
  app.quit();
});
