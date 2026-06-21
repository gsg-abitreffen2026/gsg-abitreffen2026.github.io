const ADMIN_PASSWORT = "wallnuss26";
const ADMIN_EMAIL = "maximilian.junghanss@me.com";

const UPLOAD_FOLDER_NAME = "Abitreffen";
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;
const ALLOWED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/heic", "image/heif", "image/jpg"];

// ===== Helpers =====
function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function textResponse(text) {
  return ContentService.createTextOutput(text)
    .setMimeType(ContentService.MimeType.TEXT);
}

function generateCode(length) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function sendCodeEmail(email, vorname, code) {
  MailApp.sendEmail({
    to: email,
    subject: "Zugang zur Abi2006-Galerie",
    htmlBody: `Hallo ${vorname},<br><br>
    dein persönlicher Zugangscode zur Galerie lautet:<br><br>
    <strong>${code}</strong><br><br>
    In der Galerie seht ihr ein paar Bilder der Location. Später sollen hier auch Bilder von früher aus der Schulzeit erscheinen und nach dem Klassentreffen ein paar Eindrücke der Feier.<br><br>
    Viele Grüße<br>Maxi`
  });
}

function sendAdminNewsletterNotice(vorname, nachname, email) {
  if (!ADMIN_EMAIL) return;
  try {
    MailApp.sendEmail({
      to: ADMIN_EMAIL,
      subject: "Neue Newsletter-Anmeldung",
      htmlBody: `Neue Anmeldung:<br>${vorname} ${nachname}<br>${email}`
    });
  } catch (err) {
    Logger.log("Fehler beim Admin-Hinweis: " + err);
  }
}

function ensureHeaders(sheet, headers) {
  const current = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0];
  headers.forEach((header, index) => {
    if (!current[index]) {
      sheet.getRange(1, index + 1).setValue(header);
    }
  });
}

function ensureGalerieHeaders(sheet) {
  ensureHeaders(sheet, [
    "Vorname",
    "Nachname",
    "E-Mail",
    "Freigegeben",
    "Zugangscode",
    "Upload",
    "Teilnehmer",
    "Gäste",
    "Kinder 4-11",
    "Betrag",
    "Bezahlt",
    "Pausiert"
  ]);
}

function ensureVerbindlichHeaders(sheet) {
  ensureHeaders(sheet, [
    "Timestamp",
    "E-Mail",
    "Vorname",
    "Nachname",
    "Teilnehmer",
    "Gäste",
    "Kinder 4-11",
    "Betrag"
  ]);
}

function parseCount(value, fallback) {
  const n = parseInt(value, 10);
  return isNaN(n) ? fallback : Math.max(0, n);
}

function parseAmount(value) {
  const n = parseInt(value, 10);
  return isNaN(n) ? 0 : Math.max(0, n);
}

function findGalerieUserByEmail(email) {
  const sheet = SpreadsheetApp.getActive().getSheetByName("Galerie");
  if (!sheet) return null;
  ensureGalerieHeaders(sheet);

  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const rowEmail = (rows[i][2] || "").toString().toLowerCase().trim();
    if (rowEmail === email) {
      return {
        sheet,
        rowIndex: i + 1,
        row: rows[i]
      };
    }
  }
  return null;
}

// ===== Daten aus Sheets =====
function getOffeneAnmeldungen() {
  const sheet = SpreadsheetApp.getActive().getSheetByName("Anmeldungen");
  const daten = sheet.getDataRange().getValues();
  daten.shift();

  // Zahlungsdaten aus "Verbindliche Anmeldungen" per E-Mail nachschlagen
  const verbindlichMap = {};
  const vSheet = SpreadsheetApp.getActive().getSheetByName("Verbindliche Anmeldungen");
  if (vSheet) {
    const vDaten = vSheet.getDataRange().getValues();
    vDaten.slice(1).forEach(row => {
      const email = (row[1] || "").toLowerCase().trim();
      if (email) {
        verbindlichMap[email] = {
          teilnehmer: row[4] || "",
          gaeste: row[5] || "",
          kinder: row[6] || "",
          betrag: row[7] || ""
        };
      }
    });
  }

  return daten
    .map(row => {
      const email = (row[1] || "").toLowerCase().trim();
      const zahlung = verbindlichMap[email] || {};
      return {
        vorname: row[2],
        nachname: row[3],
        email: row[1],
        teilnehmer: zahlung.teilnehmer || "",
        gaeste: zahlung.gaeste || "",
        kinder: zahlung.kinder || "",
        betrag: zahlung.betrag || ""
      };
    })
    .sort((a, b) => a.vorname.localeCompare(b.vorname));
}

function getFreigegebeneUser() {
  const sheet = SpreadsheetApp.getActive().getSheetByName("Galerie");
  ensureGalerieHeaders(sheet);
  const daten = sheet.getDataRange().getValues();
  daten.shift();

  const verbindlichMap = {};
  const vSheet = SpreadsheetApp.getActive().getSheetByName("Verbindliche Anmeldungen");
  if (vSheet) {
    vSheet.getDataRange().getValues().slice(1).forEach(r => {
      const email = (r[1] || "").toLowerCase().trim();
      if (!email) return;
      verbindlichMap[email] = {
        teilnehmer: r[4] || "",
        gaeste: r[5] || "",
        kinder: r[6] || "",
        betrag: parseInt(r[7], 10) || ""
      };
    });
  }

  return daten
    .filter(row => (row[3] || "").toString().toLowerCase() === "ja")
    .map(row => {
      const email = (row[2] || "").toLowerCase().trim();
      const v = verbindlichMap[email] || null;
      return {
        vorname: row[0] || "",
        nachname: row[1] || "",
        email: row[2],
        code: row[4] || "",
        upload: (row[5] || "").toString().toLowerCase() === "ja" ? "ja" : "nein",
        teilnehmer: row[6] || (v && v.teilnehmer) || "",
        gaeste: row[7] || (v && v.gaeste) || "",
        kinder: row[8] || (v && v.kinder) || "",
        betrag: row[9] || (v && v.betrag) || "",
        bezahlt: (row[10] || "").toString().toLowerCase() === "ja" ? "ja" : "nein",
        verbindlich: !!v,
        pausiert: (row[11] || "").toString().toLowerCase() === "ja" ? "ja" : "nein"
      };
    })
    .sort((a, b) => a.vorname.localeCompare(b.vorname));
}

// ===== Upload Helpers =====
function getUploadFolder() {
  const folders = DriveApp.getFoldersByName(UPLOAD_FOLDER_NAME);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(UPLOAD_FOLDER_NAME);
  folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return folder;
}

function getUploadSheet() {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName("GalerieUploads");
  if (!sheet) {
    sheet = ss.insertSheet("GalerieUploads");
    sheet.appendRow(["Timestamp", "Email", "FileId", "Url", "Filename", "MimeType"]);
  }
  return sheet;
}

function canUpload(email, code) {
  const sheet = SpreadsheetApp.getActive().getSheetByName("Galerie");
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const rowEmail = (rows[i][2] || "").toLowerCase().trim();
    const rowCode = (rows[i][4] || "").trim();
    const freigabe = (rows[i][3] || "").toString().toLowerCase();
    const upload = (rows[i][5] || "").toString().toLowerCase();
    if (email === rowEmail && code === rowCode && freigabe === "ja") {
      return upload === "ja";
    }
  }
  return false;
}

// ===== doGet =====
function doGet() {
  try {
    const anmeldungen = getOffeneAnmeldungen();
    const galerie = getFreigegebeneUser();
    return jsonResponse({ success: true, anmeldungen, galerie });
  } catch (error) {
    return jsonResponse({ success: false, message: error.message });
  }
}

// ===== doPost =====
function doPost(e) {
  try {
    if (!e || !e.parameter) {
      return jsonResponse({ result: "error", message: "Missing parameters" });
    }

    const action = e.parameter.action || "";

    // Public actions
    if (action === "newsletter") return handleNewsletterSignup(e);
    if (action === "verbindlich") return handleVerbindlich(e);
    if (action === "verbindlich_status") return verbindlichStatus(e);
    if (action === "login") return handleLogin(e);
    if (action === "gallery_list") return galleryList();
    if (action === "upload_image") return uploadImage(e);
    if (action === "code_reset") return codeReset(e);

    // Admin actions
    if (e.parameter.passwort === ADMIN_PASSWORT) {
      switch (action) {
        case "freigeben":
          return freigabeDurchführen(e);
        case "loeschen":
          return nutzerLoeschen(e);
        case "newsletter_admin":
          return newsletterVersenden(e);
        case "testmail":
          return testmailSenden(e);
        case "upload_set":
          return uploadSetzen(e);
        case "zahlung_bestaetigen":
          return zahlungBestaetigen(e);
        case "zahlungserinnerung":
          return zahlungserinnerung(e);
        case "pause_setzen":
          return pauseSetzen(e);
        case "debug_zahlungsdaten":
          return debugZahlungsdaten(e);
        default:
          return jsonResponse({ success: false, message: "Unbekannte Aktion" });
      }
    } else if (["freigeben", "loeschen", "newsletter_admin", "testmail", "upload_set", "zahlung_bestaetigen", "zahlungserinnerung"].includes(action)) {
      return jsonResponse({ success: false, message: "Falsches Passwort" });
    }

    return jsonResponse({ result: "error", message: "Unbekannte Aktion" });

  } catch (err) {
    Logger.log(err.stack || err);
    return jsonResponse({ result: "error", message: "doPost failed: " + (err.message || err) });
  }
}

// ===== Newsletter Anmeldung =====
function handleNewsletterSignup(e) {
  if (e.parameter._honey) {
    return jsonResponse({ result: "ignored" });
  }

  const sheet = SpreadsheetApp.getActive().getSheetByName("Anmeldungen");
  if (!sheet) return jsonResponse({ result: "error", message: "Sheet not found" });

  const email = e.parameter.email?.trim();
  const vorname = e.parameter.vorname?.trim();
  const nachname = e.parameter.nachname?.trim();

  if (!email || !vorname || !nachname) {
    return jsonResponse({ result: "error", message: "Missing fields" });
  }

  try {
    sheet.appendRow([new Date(), email, vorname, nachname]);
  } catch (err) {
    Logger.log("Fehler beim Schreiben ins Sheet: " + err);
    return jsonResponse({ result: "error", message: "Fehler beim Schreiben ins Sheet" });
  }

  try {
    MailApp.sendEmail({
      to: email,
      subject: "Bestätigung deiner Anmeldung zum Newsletter",
      htmlBody: `Hallo ${vorname || "Freund/in"},<br><br>
        vielen Dank für deine Anmeldung zum Newsletter!<br>
        Ich halte dich über alles Wichtige zum 20. Klassentreffen auf dem Laufenden.<br><br>
        Es gibt auch einen Galerie-Bereich, in dem ich zukünftig Bilder hochladen werde. Sobald ich geprüft habe, ob du dafür freigeschaltet wirst, erhältst du einen Zugangscode per Mail.<br><br>
        Herzliche Grüße<br>Maxi`,
      replyTo: ADMIN_EMAIL
    });
  } catch (err) {
    Logger.log("Fehler beim Mailversand: " + err);
    return jsonResponse({ result: "error", message: "E-Mail konnte nicht gesendet werden" });
  }

  sendAdminNewsletterNotice(vorname, nachname, email);

  return jsonResponse({ result: "success" });
}

// ===== Verbindliche Anmeldung =====
function handleVerbindlich(e) {
  if (e.parameter._honey) {
    return jsonResponse({ result: "ignored" });
  }

  const email = (e.parameter.email || "").toLowerCase().trim();
  const galerieUser = findGalerieUserByEmail(email);
  const vorname = (e.parameter.vorname || galerieUser?.row[0] || "").toString().trim();
  const nachname = (e.parameter.nachname || galerieUser?.row[1] || "").toString().trim();
  const teilnehmer = Math.max(1, parseCount(e.parameter.teilnehmer, 1));
  const gaeste = parseCount(e.parameter.gaeste, 0);
  const kinder = parseCount(e.parameter.kinder, 0);
  const betrag = parseAmount(e.parameter.betrag) || (teilnehmer * 50 + gaeste * 40 + kinder * 25);

  if (!email) {
    return jsonResponse({ result: "error", message: "Missing fields" });
  }

  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName("Verbindliche Anmeldungen");
  if (!sheet) {
    sheet = ss.insertSheet("Verbindliche Anmeldungen");
    sheet.appendRow(["Timestamp", "E-Mail", "Vorname", "Nachname", "Teilnehmer", "Gäste", "Kinder 4-11", "Betrag"]);
  } else {
    ensureVerbindlichHeaders(sheet);
  }

  const rows = sheet.getDataRange().getValues();
  let existingRow = -1;
  for (let i = 1; i < rows.length; i++) {
    const rowEmail = (rows[i][1] || "").toString().toLowerCase().trim();
    if (rowEmail === email) {
      existingRow = i + 1;
      break;
    }
  }

  const values = [new Date(), email, vorname, nachname, teilnehmer, gaeste, kinder, betrag];
  if (existingRow > -1) {
    sheet.getRange(existingRow, 1, 1, values.length).setValues([values]);
  } else {
    sheet.appendRow(values);
  }

  if (galerieUser) {
    ensureGalerieHeaders(galerieUser.sheet);
    const oldBetrag = parseInt(galerieUser.row[9] || 0, 10);
    const wasBezahlt = (galerieUser.row[10] || "").toString().toLowerCase() === "ja";
    galerieUser.sheet.getRange(galerieUser.rowIndex, 7, 1, 4)
      .setValues([[teilnehmer, gaeste, kinder, betrag]]);
    if (wasBezahlt && oldBetrag !== betrag) {
      galerieUser.sheet.getRange(galerieUser.rowIndex, 11).setValue("nein");
      MailApp.sendEmail({
        to: ADMIN_EMAIL,
        subject: `Geänderte Anmeldung – Zahlung offen: ${vorname} ${nachname}`,
        htmlBody: `Hallo Maxi,<br><br>
          <b>${vorname} ${nachname}</b> (${email}) hat seine/ihre Anmeldung geändert.<br><br>
          Alter Betrag: <b>${oldBetrag}&nbsp;€</b><br>
          Neuer Betrag: <b>${betrag}&nbsp;€</b><br><br>
          Die Zahlung war als "bezahlt" markiert und wurde auf <b>offen</b> zurückgesetzt.<br><br>
          Dein Abitreffen-System`
      });
    }
  }

  const paypalLink = `https://paypal.me/gsgabitreffen/${betrag}EUR`;

  MailApp.sendEmail({
    to: email,
    subject: "Deine verbindliche Anmeldung zum Klassentreffen 2026",
    htmlBody: `Hallo ${vorname || "Freund/in"},<br><br>
      danke für deine verbindliche Anmeldung zum Klassentreffen am <b>11.07.2026</b>
      im <b>Wirtshaus Ratze</b> in Stuttgart-Ost.<br><br>
      Erfasste Personen:<br>
      Teilnehmer: ${teilnehmer}<br>
      Partner/Gäste: ${gaeste}<br>
      Kinder von 4 bis 11 Jahren: ${kinder}<br>
      Betrag: <b>${betrag}&nbsp;€</b><br><br>
      Bitte überweise den Betrag bis zum <b>30. Juni 2026</b> über PayPal:<br>
      <a href="${paypalLink}">${paypalLink}</a><br><br>
      Falls du schon bezahlt hast – alles gut, diese Zeile einfach ignorieren.<br><br>
      Falls sich bei dir sonst etwas ändert, gib mir kurz Bescheid.<br><br>
      Herzliche Grüße<br>Maxi`,
    replyTo: ADMIN_EMAIL
  });

  return jsonResponse({ result: "success" });
}

// ===== Verbindlich-Status =====
function verbindlichStatus(e) {
  const email = (e.parameter.email || "").toLowerCase().trim();
  const code = (e.parameter.code || "").trim();
  if (!email || !code) {
    return jsonResponse({ result: "error", message: "Missing fields" });
  }

  // Login prüfen
  const galerieSheet = SpreadsheetApp.getActive().getSheetByName("Galerie");
  const rows = galerieSheet.getDataRange().getValues();
  let valid = false;
  for (let i = 1; i < rows.length; i++) {
    const rowEmail = (rows[i][2] || "").toLowerCase().trim();
    const rowCode = (rows[i][4] || "").trim();
    const freigabe = (rows[i][3] || "").toString().toLowerCase();
    if (email === rowEmail && code === rowCode && freigabe === "ja") {
      valid = true;
      break;
    }
  }
  if (!valid) {
    return jsonResponse({ result: "error", message: "Not authorized" });
  }

  const sheet = SpreadsheetApp.getActive().getSheetByName("Verbindliche Anmeldungen");
  if (!sheet) {
    return jsonResponse({ result: "success", verbindlich: false });
  }

  const data = sheet.getDataRange().getValues();
  data.shift();
  const foundRow = data.find(r => (r[1] || "").toString().toLowerCase().trim() === email);

  return jsonResponse({
    result: "success",
    verbindlich: !!foundRow,
    teilnehmer: foundRow ? foundRow[4] || "" : "",
    gaeste: foundRow ? foundRow[5] || "" : "",
    kinder: foundRow ? foundRow[6] || "" : "",
    betrag: foundRow ? foundRow[7] || "" : ""
  });
}

// ===== Login =====
function handleLogin(e) {
  const email = (e.parameter.email || "").toLowerCase().trim();
  const code = (e.parameter.code || "").trim();

  const sheet = SpreadsheetApp.getActive().getSheetByName("Galerie");
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    const rowEmail = (rows[i][2] || "").toLowerCase().trim();
    const rowCode = (rows[i][4] || "").trim();
    const freigabe = (rows[i][3] || "").toString().toLowerCase();
    const upload = (rows[i][5] || "").toString().toLowerCase();
    const name = rows[i][1] || "";

    if (email === rowEmail && code === rowCode && freigabe === "ja") {
      return jsonResponse({
        result: "success",
        name: name,
        upload: upload === "ja"
      });
    }
  }

  return jsonResponse({ result: "fail", message: "Zugangsdaten stimmen nicht." });
}

// ===== Code-Reset =====
function codeReset(e) {
  const email = (e.parameter.email || "").toLowerCase().trim();
  if (!email) {
    return jsonResponse({ result: "error", message: "Missing email" });
  }

  const sheet = SpreadsheetApp.getActive().getSheetByName("Galerie");
  if (!sheet) {
    return jsonResponse({ result: "error", message: "Sheet not found" });
  }

  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const rowEmail = (rows[i][2] || "").toLowerCase().trim(); // Spalte C
    const freigabe = (rows[i][3] || "").toString().toLowerCase(); // Spalte D

    if (rowEmail === email && freigabe === "ja") {
      let code = (rows[i][4] || "").toString().trim(); // Spalte E
      const sheetRow = i + 1;
      if (!code) {
        code = generateCode(6);
        sheet.getRange(sheetRow, 5).setValue(code);
      }

      MailApp.sendEmail({
        to: email,
        subject: "Dein Zugangscode zur Galerie",
        htmlBody: `Hallo,<br><br>hier ist dein Zugangscode für die Galerie:<br><br><strong>${code}</strong><br><br>Viele Grüße<br>Maxi`,
        replyTo: ADMIN_EMAIL
      });

      return jsonResponse({ result: "success" });
    }
  }

  return jsonResponse({
    result: "fail",
    message: "E-Mail-Adresse nicht gefunden. Bitte prüfen und ggf. neu für den Newsletter anmelden."
  });
}


// ===== Nutzer freigeben (ADMIN) =====
function freigabeDurchführen(e) {
  const emails = JSON.parse(e.parameter.emails).map(email => email.trim().toLowerCase());

  const anmeldungenSheet = SpreadsheetApp.getActive().getSheetByName("Anmeldungen");
  const galerieSheet = SpreadsheetApp.getActive().getSheetByName("Galerie");
  ensureGalerieHeaders(galerieSheet);

  const anmeldungenData = anmeldungenSheet.getDataRange().getValues();
  const galerieData = galerieSheet.getDataRange().getValues();

  anmeldungenData.shift();
  galerieData.shift();

  let geloeschteZeilen = [];

  emails.forEach(email => {
    const indexInAnmeldung = anmeldungenData.findIndex(row => (row[1] || "").toLowerCase() === email);

    if (indexInAnmeldung !== -1) {
      const row = anmeldungenData[indexInAnmeldung];
      const vorname = row[2] || "";
      const nachname = row[3] || "";
      const vollerName = vorname + " " + nachname;

      const indexInGalerie = galerieData.findIndex(row => (row[2] || "").toLowerCase() === email);

      if (indexInGalerie === -1) {
        const code = generateCode(6);
        galerieSheet.appendRow([vorname, nachname, email, "ja", code, "nein", "", "", "", ""]);
        sendCodeEmail(email, vollerName, code);
      } else {
        const existing = galerieData[indexInGalerie];
        const sheetRow = indexInGalerie + 2;
        galerieSheet.getRange(sheetRow, 4).setValue("ja");
        let code = existing[4];
        if (!code) {
          code = generateCode(6);
          galerieSheet.getRange(sheetRow, 5).setValue(code);
        }
        const upload = (existing[5] || "").toString().toLowerCase();
        if (!upload) {
          galerieSheet.getRange(sheetRow, 6).setValue("nein");
        }
        sendCodeEmail(email, vollerName, code);
      }

      geloeschteZeilen.push(indexInAnmeldung + 2);
    }
  });

  geloeschteZeilen.sort((a, b) => b - a).forEach(rowIndex => {
    anmeldungenSheet.deleteRow(rowIndex);
  });

  return jsonResponse({ success: true });
}

// ===== Nutzer löschen (ADMIN) =====
function nutzerLoeschen(e) {
  const email = (e.parameter.email || "").toLowerCase().trim();

  // Anmeldungen: E-Mail in Spalte B (Index 1)
  const anmeldungenSheet = SpreadsheetApp.getActive().getSheetByName("Anmeldungen");
  if (anmeldungenSheet) {
    const rows = anmeldungenSheet.getDataRange().getValues();
    for (let i = rows.length - 1; i >= 1; i--) {
      if ((rows[i][1] || "").toString().toLowerCase().trim() === email) {
        anmeldungenSheet.deleteRow(i + 1);
      }
    }
  }

  // Galerie: E-Mail in Spalte C (Index 2)
  const galerieSheet = SpreadsheetApp.getActive().getSheetByName("Galerie");
  if (galerieSheet) {
    const rows = galerieSheet.getDataRange().getValues();
    for (let i = rows.length - 1; i >= 1; i--) {
      if ((rows[i][2] || "").toString().toLowerCase().trim() === email) {
        galerieSheet.deleteRow(i + 1);
      }
    }
  }

  return jsonResponse({ success: true });
}

// ===== Upload-Berechtigung setzen (ADMIN) =====
function uploadSetzen(e) {
  const email = (e.parameter.email || "").toLowerCase().trim();
  const value = (e.parameter.value || "").toLowerCase() === "ja" ? "ja" : "nein";

  if (!email) return textResponse("missing email");

  const sheet = SpreadsheetApp.getActive().getSheetByName("Galerie");
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    const rowEmail = (rows[i][2] || "").toLowerCase().trim();
    if (rowEmail === email) {
      sheet.getRange(i + 1, 6).setValue(value);
      return textResponse("ok");
    }
  }

  return textResponse("not found");
}

// ===== Pausiert setzen (ADMIN) =====
function pauseSetzen(e) {
  const email = (e.parameter.email || "").toLowerCase().trim();
  const value = (e.parameter.value || "").toLowerCase() === "ja" ? "ja" : "nein";

  if (!email) return jsonResponse({ success: false, message: "Missing email" });

  const sheet = SpreadsheetApp.getActive().getSheetByName("Galerie");
  if (!sheet) return jsonResponse({ success: false, message: "Sheet not found" });
  ensureGalerieHeaders(sheet);

  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if ((rows[i][2] || "").toLowerCase().trim() === email) {
      sheet.getRange(i + 1, 12).setValue(value);
      return jsonResponse({ success: true });
    }
  }
  return jsonResponse({ success: false, message: "Nutzer nicht gefunden" });
}

// ===== Newsletter versenden (ADMIN) =====
function newsletterVersenden(e) {
  const betreff = e.parameter.subject || "Newsletter Abi 2006";
  const inhalt = e.parameter.text || "";

  const sheet = SpreadsheetApp.getActive().getSheetByName("Galerie");
  if (!sheet) return jsonResponse({ success: false, message: "Sheet not found" });

  const rows = sheet.getDataRange().getValues();
  rows.shift();

  const recipients = rows
    .filter(r =>
      (r[3] || "").toString().toLowerCase() === "ja" &&
      (r[11] || "").toString().toLowerCase() !== "ja"
    )
    .map(r => ({ email: r[2], vorname: r[0] }))
    .filter(r => r.email);

  recipients.forEach(r => {
    MailApp.sendEmail({
      to: r.email,
      subject: betreff,
      htmlBody: `Hallo ${r.vorname || "Freund/in"},<br><br>${inhalt}<br><br>Herzliche Grüße<br>Dein Orga-Team`,
      replyTo: ADMIN_EMAIL
    });
  });

  return jsonResponse({ success: true, count: recipients.length });
}

// ===== Testmail senden (ADMIN) =====
function testmailSenden(e) {
  const betreff = e.parameter.subject || "Testmail Abi 2006";
  const inhalt = e.parameter.text || "";
  const testEmail = e.parameter.email;

  MailApp.sendEmail({
    to: testEmail,
    subject: betreff,
    htmlBody: `TESTMAIL:<br><br>${inhalt}`,
    replyTo: ADMIN_EMAIL
  });

  return textResponse("Testmail wurde gesendet.");
}

// ===== Upload Image =====
function uploadImage(e) {
  const email = (e.parameter.email || "").toLowerCase().trim();
  const code = (e.parameter.code || "").trim();
  const filename = (e.parameter.filename || "upload.jpg").trim();
  const mimeType = (e.parameter.mimeType || "").trim();
  const data = e.parameter.data || "";

  if (!email || !code || !data) {
    return jsonResponse({ result: "error", message: "Missing fields" });
  }

  if (!canUpload(email, code)) {
    return jsonResponse({ result: "error", message: "Kein Upload-Recht" });
  }

  if (mimeType && !ALLOWED_UPLOAD_TYPES.includes(mimeType)) {
    return jsonResponse({ result: "error", message: "Ungültiger Dateityp" });
  }

  let bytes;
  try {
    bytes = Utilities.base64Decode(data);
  } catch (err) {
    return jsonResponse({ result: "error", message: "Ungültige Daten" });
  }

  if (bytes.length > MAX_UPLOAD_SIZE) {
    return jsonResponse({ result: "error", message: "Datei zu groß" });
  }

  const folder = getUploadFolder();
  const blob = Utilities.newBlob(bytes, mimeType || "image/jpeg", filename);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const url = "https://drive.google.com/uc?export=view&id=" + file.getId();

  const sheet = getUploadSheet();
  sheet.appendRow([new Date(), email, file.getId(), url, filename, mimeType]);

  return jsonResponse({ result: "success", url: url });
}

// ===== Galerie Liste =====
function galleryList() {
  const uploadSheet = getUploadSheet();
  const rows = uploadSheet.getDataRange().getValues();
  rows.shift();

  const galerieSheet = SpreadsheetApp.getActive().getSheetByName("Galerie");
  const nameMap = new Map();
  if (galerieSheet) {
    const gRows = galerieSheet.getDataRange().getValues();
    gRows.shift();
    gRows.forEach(r => {
      const email = (r[2] || "").toLowerCase().trim(); // Spalte C
      const vorname = (r[0] || "").toString().trim();   // Spalte A
      if (email) nameMap.set(email, vorname);
    });
  }

  const images = rows
    .map(r => {
      const email = (r[1] || "").toLowerCase().trim(); // Spalte B
      const fileId = r[2];                             // Spalte C
      if (!fileId) return null;
      const vorname = nameMap.get(email) || "";
      return {
        url: "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w1600",
        uploader: vorname ? `von ${vorname}` : ""
      };
    })
    .filter(Boolean);

  return jsonResponse({ result: "success", images });
}


// ===== Zahlungserinnerung versenden (ADMIN) =====
function zahlungserinnerung(e) {
  const sheet = SpreadsheetApp.getActive().getSheetByName("Galerie");
  if (!sheet) return jsonResponse({ success: false, message: "Sheet not found" });
  ensureGalerieHeaders(sheet);

  const rows = sheet.getDataRange().getValues();
  rows.shift();

  const verbindlichMap = {};
  const vSheet = SpreadsheetApp.getActive().getSheetByName("Verbindliche Anmeldungen");
  if (vSheet) {
    vSheet.getDataRange().getValues().slice(1).forEach(r => {
      const email = (r[1] || "").toLowerCase().trim();
      if (!email) return;
      let betrag = parseInt(r[7], 10) || 0;
      if (!betrag) {
        const tn = Math.max(1, parseInt(r[4], 10) || 1);
        const ga = parseInt(r[5], 10) || 0;
        const ki = parseInt(r[6], 10) || 0;
        betrag = tn * 50 + ga * 40 + ki * 25;
      }
      verbindlichMap[email] = betrag || "";
    });
  }

  const unpaid = rows.filter(r =>
    (r[3] || "").toString().toLowerCase() === "ja" &&
    (r[10] || "").toString().toLowerCase() !== "ja" &&
    (r[11] || "").toString().toLowerCase() !== "ja"
  );

  unpaid.forEach(r => {
    const email = (r[2] || "").toLowerCase().trim();
    const vorname = (r[0] || "").toString().trim();
    const betrag = r[9] || verbindlichMap[email] || "";
    const paypalLink = betrag ? `https://paypal.me/gsgabitreffen/${betrag}EUR` : "";

    MailApp.sendEmail({
      to: email,
      subject: "Erinnerung: Anmeldung & Zahlung – Klassentreffen 2026",
      htmlBody: `Hallo ${vorname || ""},<br><br>
        ich wollte kurz daran erinnern, dass deine verbindliche Anmeldung oder Zahlung für das Klassentreffen am <b>11. Juli 2026</b> noch aussteht.<br><br>
        Du kannst dich hier anmelden und den Zahlungslink abrufen:<br>
        <a href="https://gsg-abitreffen2026.github.io">https://gsg-abitreffen2026.github.io</a><br><br>
        Falls du bereits bezahlt hast, ignoriere diese Mail bitte – dann dauert es nur noch einen Moment, bis ich es bestätigt habe.<br><br>
        Herzliche Grüße<br>Maxi`,
      replyTo: ADMIN_EMAIL
    });
  });

  return jsonResponse({ success: true, count: unpaid.length });
}

// ===== Zahlungseingang bestätigen (ADMIN) =====
function zahlungBestaetigen(e) {
  const email = (e.parameter.email || "").toLowerCase().trim();
  if (!email) return jsonResponse({ success: false, message: "Missing email" });

  const sheet = SpreadsheetApp.getActive().getSheetByName("Galerie");
  if (!sheet) return jsonResponse({ success: false, message: "Sheet not found" });
  ensureGalerieHeaders(sheet);

  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const rowEmail = (rows[i][2] || "").toLowerCase().trim();
    if (rowEmail === email) {
      sheet.getRange(i + 1, 11).setValue("ja");

      const vorname = (rows[i][0] || "").toString().trim();
      const betrag = rows[i][9] || "";

      MailApp.sendEmail({
        to: email,
        subject: "Zahlungseingang bestätigt – Klassentreffen 2026",
        htmlBody: `Hallo ${vorname || ""},<br><br>
          dein Zahlungseingang von <b>${betrag}&nbsp;€</b> wurde bestätigt. Du bist damit vollständig für das Klassentreffen am <b>11.07.2026</b> im <b>Wirtshaus Ratze</b> angemeldet.<br><br>
          Wir freuen uns auf dich!<br><br>
          Herzliche Grüße<br>Maxi`,
        replyTo: ADMIN_EMAIL
      });

      return jsonResponse({ success: true });
    }
  }
  return jsonResponse({ success: false, message: "Nutzer nicht gefunden" });
}

// ===== Debug: Zahlungsdaten prüfen (ADMIN) =====
function debugZahlungsdaten(e) {
  const galerieSheet = SpreadsheetApp.getActive().getSheetByName("Galerie");
  if (!galerieSheet) return jsonResponse({ error: "Kein Galerie-Sheet" });
  ensureGalerieHeaders(galerieSheet);

  const rows = galerieSheet.getDataRange().getValues();
  rows.shift();

  const verbindlichMap = {};
  const vSheet = SpreadsheetApp.getActive().getSheetByName("Verbindliche Anmeldungen");
  if (vSheet) {
    vSheet.getDataRange().getValues().slice(1).forEach(r => {
      const email = (r[1] || "").toLowerCase().trim();
      if (email) verbindlichMap[email] = r[7] || "";
    });
  }

  const result = rows.map(r => {
    const email = (r[2] || "").toLowerCase().trim();
    const betragGalerie = r[9];
    const betragVerbindlich = verbindlichMap[email];
    const betragFinal = betragGalerie || betragVerbindlich || "";
    return {
      email,
      freigegeben: (r[3] || "").toString(),
      betragGalerie,
      betragVerbindlich,
      betragFinal,
      bezahlt: (r[10] || "").toString()
    };
  });

  return jsonResponse({
    galerieZeilen: result.length,
    verbindlichEintraege: Object.keys(verbindlichMap).length,
    daten: result
  });
}

// ===== Hilfs-Tests =====
function testDriveAuth() {
  const f = DriveApp.createFile("auth-test.txt", "ok");
  f.setTrashed(true);
}

function fixUploadSharing() {
  const folder = getUploadFolder();
  const sheet = getUploadSheet();
  const rows = sheet.getDataRange().getValues();
  const map = new Map(rows.slice(1).map((r, i) => [r[2], i + 2]));

  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const url = "https://drive.google.com/uc?export=download&id=" + file.getId();
    const row = map.get(file.getId());
    if (row) sheet.getRange(row, 4).setValue(url);
  }
}
