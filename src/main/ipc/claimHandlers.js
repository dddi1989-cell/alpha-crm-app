const { ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { getExistingUploadedPdf, generatePdfForCompany } = require('../services/documentParserService');

function registerClaimHandlers(mainWindow) {
  ipcMain.handle('claims:download-form', async (event, company) => {
    try {
      const existingPdf = getExistingUploadedPdf(company);

      const result = await dialog.showSaveDialog(mainWindow, {
        title: `[${company.name}] 공식 보험금 청구서 저장`,
        defaultPath: path.join(
          process.env.USERPROFILE || process.env.HOME || '',
          'Desktop',
          `[${company.name}]_공식_보험금청구서.pdf`
        ),
        filters: [{ name: 'PDF Documents', extensions: ['pdf'] }]
      });

      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
      }

      if (existingPdf) {
        fs.copyFileSync(existingPdf, result.filePath);
      } else {
        await generatePdfForCompany(company, result.filePath);
      }

      shell.showItemInFolder(result.filePath);
      return { success: true, filePath: result.filePath };
    } catch (err) {
      console.error('claims:download-form error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('claims:open-pdf', async (event, company) => {
    try {
      const existingPdf = getExistingUploadedPdf(company);
      if (existingPdf) {
        await shell.openPath(existingPdf);
        return { success: true, filePath: existingPdf };
      }

      const tempDir = require('electron').app.getPath('temp');
      const tempPdfPath = path.join(tempDir, `[${company.name}]_공식_보험금청구서.pdf`);
      await generatePdfForCompany(company, tempPdfPath);
      await shell.openPath(tempPdfPath);
      return { success: true, filePath: tempPdfPath };
    } catch (err) {
      console.error('claims:open-pdf error:', err);
      return { success: false, error: err.message };
    }
  });
}

module.exports = {
  registerClaimHandlers
};
