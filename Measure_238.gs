/**
 * ==============================================================================
 * MEASURE 238 MEDICATION RECOGNIZER - GOOGLE APPS SCRIPT
 * ==============================================================================
 * Measure: Quality ID #238 (CBE 0022): Use of High-Risk Medications in Older Adults
 * Performance Year: 2026 MIPS CQM (Version 10.0, Dec 2025)
 *
 * ENHANCED DRUG CLASS & 2-ORDER THRESHOLD RECOGNITION:
 * Measure 238 requires AT LEAST TWO orders from the same drug class (or 2 orders of the
 * same drug) on different dates of service to trigger numerator compliance.
 *
 * This scanner now:
 * 1. Groups detected medications by Drug Class.
 * 2. Counts total occurrences / orders for each drug class across the entire sheet.
 * 3. Flags "Review Required: YES" ONLY if 2 or more orders/medications are detected
 *    in the SAME drug class.
 * 4. Flags "Review Required: NO (Single Order Found)" if only 1 order is detected,
 *    since a single order does not meet the 2-order Measure 238 criteria.
 * ==============================================================================
 */

// ==============================================================================
// 1. CONFIGURATION & CONSTANTS
// ==============================================================================
const CONFIG = {
  VERSION: '1.1.0',
  AUTHOR: 'MIPS Quality Engineering Team',
  HIGHLIGHT_COLOR_MULTI: '#FFF2CC', // Soft yellow for 2+ orders in same class (Actionable)
  HIGHLIGHT_COLOR_SINGLE: '#E8F0FE', // Soft blue for single order (Informational)
  SUMMARY_MARKER: '==================================',
  SUMMARY_TITLE_TEXT: 'MEASURE 238 SCAN RESULT'
};

/**
 * Complete Database of Measure 238 High-Risk Medications (Tables 1, 2, 3, and 4)
 */
const MEASURE_238_DATABASE = [
  // ============================================================================
  // TABLE 1: High-Risk Medications at any Dose or Duration
  // ============================================================================
  { name: 'Brompheniramine', class: 'Anticholinergics (1st-gen antihistamines)', table: 'Table 1', brands: ['Dimetane', 'Dimetapp', 'Bromfed'] },
  { name: 'Chlorpheniramine', class: 'Anticholinergics (1st-gen antihistamines)', table: 'Table 1', brands: ['Chlor-Trimeton', 'Diabetan'] },
  { name: 'Cyproheptadine', class: 'Anticholinergics (1st-gen antihistamines)', table: 'Table 1', brands: ['Periactin'] },
  { name: 'Dimenhydrinate', class: 'Anticholinergics (1st-gen antihistamines)', table: 'Table 1', brands: ['Dramamine', 'Driminate'] },
  { name: 'Diphenhydramine', class: 'Anticholinergics (1st-gen antihistamines)', table: 'Table 1', brands: ['Benadryl', 'Sominex', 'Nytol', 'ZzzQuil', 'Diphen'] },
  { name: 'Doxylamine', class: 'Anticholinergics (1st-gen antihistamines)', table: 'Table 1', brands: ['Unisom', 'Aldex'] },
  { name: 'Hydroxyzine', class: 'Anticholinergics (1st-gen antihistamines)', table: 'Table 1', brands: ['Atarax', 'Vistaril'] },
  { name: 'Meclizine', class: 'Anticholinergics (1st-gen antihistamines)', table: 'Table 1', brands: ['Antivert', 'Bonine', 'Dramamine II'] },
  { name: 'Promethazine', class: 'Anticholinergics (1st-gen antihistamines)', table: 'Table 1', brands: ['Phenergan', 'Promethegan'] },
  { name: 'Triprolidine', class: 'Anticholinergics (1st-gen antihistamines)', table: 'Table 1', brands: ['Actifed', 'Histex'] },
  { name: 'Benztropine', class: 'Anticholinergics (Anti-Parkinson)', table: 'Table 1', brands: ['Cogentin'] },
  { name: 'Trihexyphenidyl', class: 'Anticholinergics (Anti-Parkinson)', table: 'Table 1', brands: ['Artane'] },
  { name: 'Atropine', class: 'Antispasmodics', table: 'Table 1', brands: ['Atropen', 'Sal-Atropine'] },
  { name: 'Chlordiazepoxide-clidinium', class: 'Antispasmodics', table: 'Table 1', brands: ['Librax'], matchOverride: /(?:^|[^a-zA-Z0-9_])(?:Chlordiazepoxide[\s\-\/]*clidinium|Librax)(?:$|[^a-zA-Z0-9_])/i },
  { name: 'Dicyclomine', class: 'Antispasmodics', table: 'Table 1', brands: ['Bentyl'] },
  { name: 'Hyoscyamine', class: 'Antispasmodics', table: 'Table 1', brands: ['Levsin', 'Levbid', 'Anaspaz', 'Symax', 'Nulev'] },
  { name: 'Scopolamine', class: 'Antispasmodics', table: 'Table 1', brands: ['Transderm-Scop', 'Maldemar', 'Scopace'] },
  { name: 'Dipyridamole', class: 'Antithrombotics', table: 'Table 1', brands: ['Persantine'] },
  { name: 'Guanfacine', class: 'Cardiovascular (Central Alpha Agonists)', table: 'Table 1', brands: ['Tenex', 'Intuniv'] },
  { name: 'Nifedipine', class: 'Cardiovascular (Calcium Channel Blockers)', table: 'Table 1', brands: ['Procardia', 'Adalat'] },
  { name: 'Amitriptyline', class: 'CNS (Antidepressants - TCAs)', table: 'Table 1', brands: ['Elavil', 'Endep'] },
  { name: 'Amoxapine', class: 'CNS (Antidepressants - TCAs)', table: 'Table 1', brands: ['Asendin'] },
  { name: 'Clomipramine', class: 'CNS (Antidepressants - TCAs)', table: 'Table 1', brands: ['Anafranil'] },
  { name: 'Desipramine', class: 'CNS (Antidepressants - TCAs)', table: 'Table 1', brands: ['Norpramin'] },
  { name: 'Imipramine', class: 'CNS (Antidepressants - TCAs)', table: 'Table 1', brands: ['Tofranil'] },
  { name: 'Nortriptyline', class: 'CNS (Antidepressants - TCAs)', table: 'Table 1', brands: ['Pamelor', 'Aventyl'] },
  { name: 'Paroxetine', class: 'CNS (Antidepressants - SSRIs)', table: 'Table 1', brands: ['Paxil', 'Pexeva', 'Brisdelle'] },
  { name: 'Butalbital', class: 'CNS (Barbiturates)', table: 'Table 1', brands: ['Fioricet', 'Fiorinal', 'Esgic'] },
  { name: 'Phenobarbital', class: 'CNS (Barbiturates)', table: 'Table 1', brands: ['Luminal', 'Solfoton'] },
  { name: 'Primidone', class: 'CNS (Barbiturates)', table: 'Table 1', brands: ['Mysoline'] },
  { name: 'Ergoloid mesylates', class: 'CNS (Vasodilators)', table: 'Table 1', brands: ['Hydergine'] },
  { name: 'Meprobamate', class: 'CNS (Sedatives/Anxiolytics)', table: 'Table 1', brands: ['Miltown', 'Equanil'] },
  { name: 'Conjugated estrogen', class: 'Endocrine (Estrogens)', table: 'Table 1', brands: ['Premarin'] },
  { name: 'Esterified estrogen', class: 'Endocrine (Estrogens)', table: 'Table 1', brands: ['Estratab', 'Menest'] },
  { name: 'Estradiol', class: 'Endocrine (Estrogens)', table: 'Table 1', brands: ['Estrace', 'Climara', 'Vivelle-Dot', 'Minivelle', 'Estraderm', 'Vagifem'] },
  { name: 'Estropipate', class: 'Endocrine (Estrogens)', table: 'Table 1', brands: ['Ogen', 'Ortho-Est'] },
  { name: 'Glimepiride', class: 'Endocrine (Sulfonylureas, Long-Duration)', table: 'Table 1', brands: ['Amaryl'] },
  { name: 'Glyburide', class: 'Endocrine (Sulfonylureas, Long-Duration)', table: 'Table 1', brands: ['DiaBeta', 'Micronase', 'Glynase'] },
  { name: 'Desiccated thyroid', class: 'Endocrine (Thyroid)', table: 'Table 1', brands: ['Armour Thyroid', 'Nature-Throid', 'NP Thyroid', 'Westhroid'] },
  { name: 'Megestrol', class: 'Endocrine (Progestins)', table: 'Table 1', brands: ['Megace'] },
  { name: 'Eszopiclone', class: 'Nonbenzodiazepine Hypnotics', table: 'Table 1', brands: ['Lunesta'] },
  { name: 'Zaleplon', class: 'Nonbenzodiazepine Hypnotics', table: 'Table 1', brands: ['Sonata'] },
  { name: 'Zolpidem', class: 'Nonbenzodiazepine Hypnotics', table: 'Table 1', brands: ['Ambien', 'Edluar', 'Intermezzo', 'Zolpimist'] },
  { name: 'Carisoprodol', class: 'Pain (Skeletal Muscle Relaxants)', table: 'Table 1', brands: ['Soma'] },
  { name: 'Chlorzoxazone', class: 'Pain (Skeletal Muscle Relaxants)', table: 'Table 1', brands: ['Parafon Forte', 'Lorzone'] },
  { name: 'Cyclobenzaprine', class: 'Pain (Skeletal Muscle Relaxants)', table: 'Table 1', brands: ['Flexeril', 'Amrix', 'Fexmid'] },
  { name: 'Metaxalone', class: 'Pain (Skeletal Muscle Relaxants)', table: 'Table 1', brands: ['Skelaxin'] },
  { name: 'Methocarbamol', class: 'Pain (Skeletal Muscle Relaxants)', table: 'Table 1', brands: ['Robaxin'] },
  { name: 'Orphenadrine', class: 'Pain (Skeletal Muscle Relaxants)', table: 'Table 1', brands: ['Norflex'] },
  { name: 'Meperidine', class: 'Pain (Opioids)', table: 'Table 1', brands: ['Demerol'] },
  { name: 'Indomethacin', class: 'Pain (NSAIDs)', table: 'Table 1', brands: ['Indocin', 'Tivorbex'] },
  { name: 'Ketorolac', class: 'Pain (NSAIDs)', table: 'Table 1', brands: ['Toradol', 'Sprix'] },

  // ============================================================================
  // TABLE 2: High-Risk Medications With Days Supply Criteria (>90 Days)
  // ============================================================================
  { name: 'Nitrofurantoin', class: 'Anti-Infectives (Days Supply > 90 Days)', table: 'Table 2', brands: ['Macrodantin', 'Macrobid', 'Furadantin'] },

  // ============================================================================
  // TABLE 3: High-Risk Medications With Average Daily Dose Criteria
  // ============================================================================
  { name: 'Digoxin', class: 'Cardiovascular (Average Daily Dose > 0.125 mg/day)', table: 'Table 3', brands: ['Lanoxin', 'Digitek'] },
  { name: 'Doxepin', class: 'Tertiary TCAs (Average Daily Dose > 6 mg/day)', table: 'Table 3', brands: ['Sinequan', 'Silenor', 'Zonalon', 'Prudoxin'] },

  // ============================================================================
  // TABLE 4: High-Risk Medications (Antipsychotics & Benzodiazepines)
  // ============================================================================
  { name: 'Aripiprazole', class: 'Antipsychotics', table: 'Table 4', brands: ['Abilify', 'Aristada'] },
  { name: 'Aripiprazole lauroxil', class: 'Antipsychotics', table: 'Table 4', brands: ['Aristada'] },
  { name: 'Asenapine', class: 'Antipsychotics', table: 'Table 4', brands: ['Saphris', 'Secuado'] },
  { name: 'Brexpiprazole', class: 'Antipsychotics', table: 'Table 4', brands: ['Rexulti'] },
  { name: 'Cariprazine', class: 'Antipsychotics', table: 'Table 4', brands: ['Vraylar'] },
  { name: 'Chlorpromazine', class: 'Antipsychotics', table: 'Table 4', brands: ['Thorazine'] },
  { name: 'Clozapine', class: 'Antipsychotics', table: 'Table 4', brands: ['Clozaril', 'Fazaclo', 'Versacloz'] },
  { name: 'Fluphenazine', class: 'Antipsychotics', table: 'Table 4', brands: ['Prolixin'] },
  { name: 'Haloperidol', class: 'Antipsychotics', table: 'Table 4', brands: ['Haldol'] },
  { name: 'Iloperidone', class: 'Antipsychotics', table: 'Table 4', brands: ['Fanapt'] },
  { name: 'Loxapine', class: 'Antipsychotics', table: 'Table 4', brands: ['Loxitane', 'Adasuve'] },
  { name: 'Lurasidone', class: 'Antipsychotics', table: 'Table 4', brands: ['Latuda'] },
  { name: 'Molindone', class: 'Antipsychotics', table: 'Table 4', brands: ['Moban'] },
  { name: 'Olanzapine', class: 'Antipsychotics', table: 'Table 4', brands: ['Zyprexa', 'Relprevv'] },
  { name: 'Paliperidone', class: 'Antipsychotics', table: 'Table 4', brands: ['Invega'] },
  { name: 'Perphenazine', class: 'Antipsychotics', table: 'Table 4', brands: ['Trilafon'] },
  { name: 'Pimavanserin', class: 'Antipsychotics', table: 'Table 4', brands: ['Nuplazid'] },
  { name: 'Pimozide', class: 'Antipsychotics', table: 'Table 4', brands: ['Orap'] },
  { name: 'Quetiapine', class: 'Antipsychotics', table: 'Table 4', brands: ['Seroquel'] },
  { name: 'Risperidone', class: 'Antipsychotics', table: 'Table 4', brands: ['Risperdal', 'Perseris'] },
  { name: 'Thioridazine', class: 'Antipsychotics', table: 'Table 4', brands: ['Mellaril'] },
  { name: 'Thiothixene', class: 'Antipsychotics', table: 'Table 4', brands: ['Navane'] },
  { name: 'Trifluoperazine', class: 'Antipsychotics', table: 'Table 4', brands: ['Stelazine'] },
  { name: 'Ziprasidone', class: 'Antipsychotics', table: 'Table 4', brands: ['Geodon'] },
  { name: 'Alprazolam', class: 'Benzodiazepines', table: 'Table 4', brands: ['Xanax', 'Niravam'] },
  {
    name: 'Chlordiazepoxide',
    class: 'Benzodiazepines',
    table: 'Table 4',
    brands: ['Librium'],
    matchOverride: /(?:^|[^a-zA-Z0-9_])(?:Chlordiazepoxide(?![\s\-\/]*clidinium)|Librium)(?:$|[^a-zA-Z0-9_])/i
  },
  { name: 'Clobazam', class: 'Benzodiazepines', table: 'Table 4', brands: ['Onfi', 'Sympazan'] },
  { name: 'Clonazepam', class: 'Benzodiazepines', table: 'Table 4', brands: ['Klonopin'] },
  { name: 'Clorazepate', class: 'Benzodiazepines', table: 'Table 4', brands: ['Tranxene'] },
  { name: 'Diazepam', class: 'Benzodiazepines', table: 'Table 4', brands: ['Valium', 'Diastat', 'Valtoco'] },
  { name: 'Estazolam', class: 'Benzodiazepines', table: 'Table 4', brands: ['Prosom'] },
  { name: 'Lorazepam', class: 'Benzodiazepines', table: 'Table 4', brands: ['Ativan', 'Loreev'] },
  { name: 'Midazolam', class: 'Benzodiazepines', table: 'Table 4', brands: ['Versed', 'Nayzilam'] },
  { name: 'Oxazepam', class: 'Benzodiazepines', table: 'Table 4', brands: ['Serax'] },
  { name: 'Temazepam', class: 'Benzodiazepines', table: 'Table 4', brands: ['Restoril'] },
  { name: 'Triazolam', class: 'Benzodiazepines', table: 'Table 4', brands: ['Halcion'] }
];

const COMPILED_MED_PATTERNS = compileMedicationPatterns(MEASURE_238_DATABASE);


// ==============================================================================
// 2. UI MENU HANDLERS
// ==============================================================================

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Measure 238 Scanner')
    .addItem('🔍 Scan Active Sheet', 'scanActiveSheet')
    .addSeparator()
    .addItem('🧹 Clear Highlights', 'clearHighlights')
    .addItem('🗑️ Clear Summary', 'clearSummary')
    .addSeparator()
    .addItem('ℹ️ About', 'showAbout')
    .addToUi();
}


// ==============================================================================
// 3. CORE SCANNING & DRUG CLASS AGGREGATION ENGINE
// ==============================================================================

function scanActiveSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const startTime = new Date().getTime();

  // 1. Remove previous summary first
  removeSummaryFromSheet(sheet);

  const dataRange = sheet.getDataRange();
  const numRows = dataRange.getNumRows();
  const numCols = dataRange.getNumColumns();

  if (numRows === 0 || numCols === 0) {
    SpreadsheetApp.getUi().alert('The active sheet is empty. Please paste EHR medication data first.');
    return;
  }

  // 2. Single-pass batch read
  const displayValues = dataRange.getDisplayValues();
  const backgrounds = dataRange.getBackgrounds();
  const notes = dataRange.getNotes();

  let cellsScanned = 0;
  let matchingCellsCount = 0;

  // Track cell matches: list of { r, c, matches }
  const cellMatchList = [];

  // Track Drug Class counts across entire sheet
  // Key: drugClass -> { className, table, meds: Map(medName -> { med, count }), totalOccurrences: number }
  const drugClassMap = new Map();

  // 3. Pass 1: Memory Scan & Aggregate Counts
  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      const cellText = displayValues[r][c];

      if (!cellText || cellText.trim() === '') {
        continue;
      }

      cellsScanned++;
      const matches = findMedicationMatches(cellText);

      if (matches.length > 0) {
        matchingCellsCount++;
        cellMatchList.push({ r, c, matches });

        matches.forEach(m => {
          const className = m.med.class;
          if (!drugClassMap.has(className)) {
            drugClassMap.set(className, {
              className: className,
              table: m.med.table,
              medsMap: new Map(),
              totalOccurrences: 0
            });
          }

          const classObj = drugClassMap.get(className);
          classObj.totalOccurrences++;

          if (!classObj.medsMap.has(m.med.name)) {
            classObj.medsMap.set(m.med.name, {
              med: m.med,
              matchedAs: [m.matchedName],
              count: 1
            });
          } else {
            const medEntry = classObj.medsMap.get(m.med.name);
            medEntry.count++;
            if (!medEntry.matchedAs.includes(m.matchedName)) {
              medEntry.matchedAs.push(m.matchedName);
            }
          }
        });
      }
    }
  }

  // Determine if ANY drug class meets the 2+ order threshold required for Measure 238
  let classesWith2PlusOrdersCount = 0;
  drugClassMap.forEach(classObj => {
    // 2+ occurrences OR 2+ distinct medications in the same drug class
    if (classObj.totalOccurrences >= 2 || classObj.medsMap.size >= 2) {
      classObj.hasTwoPlusOrders = true;
      classesWith2PlusOrdersCount++;
    } else {
      classObj.hasTwoPlusOrders = false;
    }
  });

  const isNumeratorPotentialMatch = classesWith2PlusOrdersCount > 0;

  // 4. Pass 2: Apply Highlights & Cell Notes based on 2+ order rule
  cellMatchList.forEach(item => {
    const r = item.r;
    const c = item.c;

    // Check if any match in this cell belongs to a drug class with 2+ orders across the sheet
    const hasClassWithTwoPlus = item.matches.some(m => {
      const classObj = drugClassMap.get(m.med.class);
      return classObj && classObj.hasTwoPlusOrders;
    });

    if (hasClassWithTwoPlus) {
      backgrounds[r][c] = CONFIG.HIGHLIGHT_COLOR_MULTI; // Soft Yellow (2+ orders found - Actionable Review)
    } else {
      backgrounds[r][c] = CONFIG.HIGHLIGHT_COLOR_SINGLE; // Soft Blue (Only 1 order found - Single Order)
    }

    const noteLines = [];
    if (hasClassWithTwoPlus) {
      noteLines.push('⚠️ Measure 238 Match (2+ Orders in Drug Class Found)');
    } else {
      noteLines.push('ℹ️ Single Medication Order (Measure 238 requires 2+ orders from same class)');
    }

    item.matches.forEach(m => {
      const classObj = drugClassMap.get(m.med.class);
      noteLines.push(`• Med: ${m.med.name}`);
      if (m.matchedName.toLowerCase() !== m.med.name.toLowerCase()) {
        noteLines.push(`  (Brand: ${m.matchedName})`);
      }
      noteLines.push(`  Class: ${m.med.class}`);
      noteLines.push(`  Table: ${m.med.table}`);
      noteLines.push(`  Total Class Orders Found: ${classObj.totalOccurrences}`);
    });

    notes[r][c] = noteLines.join('\n');
  });

  // Batch Write Formatting & Notes
  if (cellMatchList.length > 0) {
    dataRange.setBackgrounds(backgrounds);
    dataRange.setNotes(notes);
  }

  // 5. Append Summary Report
  const executionTimeSec = ((new Date().getTime() - startTime) / 1000).toFixed(2);
  appendSummaryReport(
    sheet,
    numRows,
    cellsScanned,
    matchingCellsCount,
    Array.from(drugClassMap.values()),
    isNumeratorPotentialMatch,
    executionTimeSec
  );

  // 6. Alert User
  const ui = SpreadsheetApp.getUi();
  if (isNumeratorPotentialMatch) {
    ui.alert(
      '⚠️ Measure 238 Review Required',
      `Found ${matchingCellsCount} cell match(es) with 2+ ORDERS IN THE SAME DRUG CLASS.\n\n` +
      `Review Required: YES ⚠️\n` +
      `Highlighted in Yellow (Actionable Match). Details added to cell notes and summary.`,
      ui.ButtonSet.OK
    );
  } else if (matchingCellsCount > 0) {
    ui.alert(
      'ℹ️ Single Medication Order Detected',
      `Found ${matchingCellsCount} cell match(es), but ONLY 1 ORDER was detected for the drug class.\n\n` +
      `Review Required: NO ✅ (Measure 238 requires 2+ orders from the same drug class on different dates of service).\n` +
      `Highlighted in Soft Blue (Single Order Informational).`,
      ui.ButtonSet.OK
    );
  } else {
    ui.alert(
      '✅ Measure 238 Scan Complete',
      `Scanned ${cellsScanned} cells. No Measure 238 high-risk medications detected.\n\nReview Required: NO ✅`,
      ui.ButtonSet.OK
    );
  }
}


// ==============================================================================
// 4. REGEX PATTERN COMPILATION & MATCHING ENGINE
// ==============================================================================

function compileMedicationPatterns(db) {
  const compiled = [];

  db.forEach(entry => {
    if (entry.matchOverride) {
      compiled.push({
        regex: entry.matchOverride,
        matchedName: entry.name,
        med: entry
      });
      return;
    }

    const terms = [entry.name, ...(entry.brands || [])];

    terms.forEach(term => {
      const escaped = term.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
      const patternString = `(?:^|[^a-zA-Z0-9_])${escaped}(?:$|[^a-zA-Z0-9_])`;
      const regex = new RegExp(patternString, 'i');

      compiled.push({
        regex: regex,
        matchedName: term,
        med: entry
      });
    });
  });

  return compiled;
}

function findMedicationMatches(text) {
  if (!text || typeof text !== 'string') return [];

  const normalizedText = text.replace(/[\r\n\t]+/g, ' ').trim();
  if (normalizedText === '') return [];

  const matchedMeds = new Map();

  for (let i = 0; i < COMPILED_MED_PATTERNS.length; i++) {
    const item = COMPILED_MED_PATTERNS[i];
    if (item.regex.test(normalizedText)) {
      if (!matchedMeds.has(item.med.name)) {
        matchedMeds.set(item.med.name, {
          med: item.med,
          matchedName: item.matchedName
        });
      }
    }
  }

  return Array.from(matchedMeds.values());
}


// ==============================================================================
// 5. SUMMARY REPORT GENERATION & CLEANUP
// ==============================================================================

function appendSummaryReport(sheet, dataRows, cellsScanned, matchCells, drugClassesList, isNumeratorPotentialMatch, executionTime) {
  const startRow = dataRows + 3;

  const dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  const reviewRequiredStr = isNumeratorPotentialMatch
    ? 'YES ⚠️ (2+ Orders in Same Drug Class Found)'
    : (matchCells > 0 ? 'NO ✅ (Single Order Found - 2 Required for Measure 238)' : 'NO ✅');

  const summaryData = [
    [CONFIG.SUMMARY_MARKER, ''],
    [CONFIG.SUMMARY_TITLE_TEXT, ''],
    [CONFIG.SUMMARY_MARKER, ''],
    ['Scan Date:', dateStr],
    ['Cells Scanned:', cellsScanned],
    ['Cells Containing Matches:', matchCells],
    ['Unique Drug Classes Detected:', drugClassesList.length],
    ['Review Required:', reviewRequiredStr],
    ['--------------------------------------------------', '']
  ];

  if (drugClassesList.length === 0) {
    summaryData.push(['Result:', 'No Measure 238 high-risk medications detected.']);
  } else {
    summaryData.push(['DETECTED DRUG CLASSES & MEDICATION SUMMARY:', '']);
    summaryData.push(['', '']);

    drugClassesList.forEach((classObj) => {
      const statusSymbol = classObj.hasTwoPlusOrders ? '⚠️ [2+ Orders - POTENTIAL NUMERATOR MATCH]' : 'ℹ️ [Single Order - 2 Required]';
      summaryData.push([`Drug Class: ${classObj.className}`, statusSymbol]);
      summaryData.push(['    Measure Table:', classObj.table]);
      summaryData.push(['    Total Orders/Occurrences in Class:', classObj.totalOccurrences]);

      const medsArray = Array.from(classObj.medsMap.values());
      medsArray.forEach(m => {
        const brandsText = m.matchedAs.filter(b => b.toLowerCase() !== m.med.name.toLowerCase()).join(', ');
        const brandStr = brandsText ? ` (Matched Brand: ${brandsText})` : '';
        summaryData.push([`    • ${m.med.name}${brandStr}`, `Cell Occurrences: ${m.count}`]);
      });

      summaryData.push(['', '']);
    });
  }

  summaryData.push([CONFIG.SUMMARY_MARKER, '']);

  const rows = summaryData.length;
  const summaryRange = sheet.getRange(startRow, 1, rows, 2);
  summaryRange.setValues(summaryData);

  sheet.getRange(startRow + 1, 1).setFontWeight('bold').setFontSize(11);

  const statusCell = sheet.getRange(startRow + 7, 2);
  if (isNumeratorPotentialMatch) {
    statusCell.setFontWeight('bold').setFontColor('#C00000'); // Red for Review Required
  } else {
    statusCell.setFontWeight('bold').setFontColor('#38761D'); // Green for No Review
  }

  const boldRows = [startRow + 3, startRow + 4, startRow + 5, startRow + 6, startRow + 7, startRow + 9];
  boldRows.forEach(r => sheet.getRange(r, 1).setFontWeight('bold'));
}

function removeSummaryFromSheet(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow === 0) return;

  const firstColValues = sheet.getRange(1, 1, lastRow, 1).getDisplayValues();
  let summaryStartRow = -1;

  for (let r = 0; r < firstColValues.length; r++) {
    if (firstColValues[r][0] === CONFIG.SUMMARY_MARKER) {
      summaryStartRow = r + 1;
      break;
    }
  }

  if (summaryStartRow !== -1) {
    const rowsToDelete = lastRow - summaryStartRow + 1;
    sheet.getRange(summaryStartRow, 1, rowsToDelete, sheet.getMaxColumns()).clear({
      contentsOnly: true,
      formatOnly: true,
      validationsOnly: true,
      commentsOnly: true
    });
  }
}


// ==============================================================================
// 6. CLEAR HIGHLIGHTS & CLEAR SUMMARY USER COMMANDS
// ==============================================================================

function clearHighlights() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const dataRange = sheet.getDataRange();

  if (dataRange.getNumRows() === 0) return;

  dataRange.setBackground(null);
  dataRange.clearNote();

  SpreadsheetApp.getUi().alert('🧹 Highlights and notes cleared successfully.');
}

function clearSummary() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  removeSummaryFromSheet(sheet);
  SpreadsheetApp.getUi().alert('🗑️ Scan summary cleared successfully.');
}


// ==============================================================================
// 7. ABOUT DIALOG
// ==============================================================================

function showAbout() {
  const ui = SpreadsheetApp.getUi();
  const message =
    `Measure 238 High-Risk Medication Recognizer\n` +
    `Version: ${CONFIG.VERSION}\n` +
    `Author: ${CONFIG.AUTHOR}\n\n` +
    `Purpose:\n` +
    `Scans pasted EHR medication lists across any column layout or format, ` +
    `recognizes Measure 238 high-risk medications (Tables 1, 2, 3, and 4), ` +
    `groups detections by drug class, and flags "Review Required: YES" ONLY when ` +
    `2 or more orders from the same drug class are detected.\n\n` +
    `Single orders are highlighted in Soft Blue (Informational), while 2+ orders ` +
    `are highlighted in Soft Yellow (Review Required).`;

  ui.alert('About Measure 238 Scanner', message, ui.ButtonSet.OK);
}
