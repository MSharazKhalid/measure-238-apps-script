/**
 * ==============================================================================
 * QUALITY ID #238 (CBE 0022)
 * USE OF HIGH-RISK MEDICATIONS IN OLDER ADULTS
 * 2026 MIPS CQM - VERSION 10.0 (DECEMBER 2025)
 * ==============================================================================
 *
 * PURPOSE
 * -------
 * This script is a SCREENING TOOL.
 *
 * The team copies the patient's CURRENT MEDICATIONS section from the EHR
 * and pastes it into Google Sheets.
 *
 * The script:
 * 1. Detects Measure 238 high-risk medications (Tables 1-4).
 * 2. Identifies the correct Measure 238 table and drug class.
 * 3. Groups medications by drug class.
 * 4. Gives specific MANUAL REVIEW INSTRUCTIONS.
 * 5. Warns when a drug's FORM/ROUTE affects eligibility.
 * 6. Does NOT claim that a patient is automatically numerator compliant.
 *
 * IMPORTANT:
 * The EHR Current Medications section usually shows medications that are
 * currently active. It may NOT show order dates, previous orders, days
 * supply history, average daily dose details, the ordering provider, or
 * historical diagnoses needed for Table 4.
 * Therefore, this script identifies patients that REQUIRE MANUAL REVIEW.
 *
 * MEASURE REMINDERS (2026 spec):
 * - Submission Criteria 1 = Tables 1, 2, 3. This rate is used for MIPS
 *   performance. Diagnosis does NOT matter for Tables 1-3.
 * - Submission Criteria 2 = Table 4 (antipsychotics, benzodiazepines).
 *   Appropriate diagnosis = Performance Not Met (G0032 / G0033).
 *
 * v2.2.0 CHANGES (checked against 2026 spec v10.0):
 * - Estrogens: added route warning (only oral and topical patch count).
 *   Removed Vagifem (vaginal) from Estradiol brands.
 * - Diphenhydramine: added "oral only" warning.
 * - Benztropine: added "oral only" warning.
 * - Dipyridamole: warning now says oral AND not extended-release.
 * - Table 4 checklist: diagnosis = Performance Not Met (G0032/G0033),
 *   not "excluded". Benzo diagnosis now says SEVERE generalized anxiety.
 * - Digoxin / Doxepin checklist: exactly 0.125 mg / 6 mg does NOT qualify.
 * - Bug fix: "Aristada" and "Aripiprazole lauroxil" no longer also match
 *   plain Aripiprazole (false yellow).
 * - Bug fix: "Dramamine II" / "Less Drowsy" (meclizine) no longer also
 *   match Dimenhydrinate (false yellow).
 * - Bug fix: class instructions now use getManualInstructionsForClass().
 *
 * ==============================================================================
 */

// ==============================================================================
// 1. CONFIGURATION
// ==============================================================================

const CONFIG = {
  VERSION: '2.2.0',
  AUTHOR: 'MIPS Quality Engineering Team',

  HIGHLIGHT_REVIEW: '#FFF2CC',
  HIGHLIGHT_INFO: '#E8F0FE',

  SUMMARY_MARKER: '==================================',
  SUMMARY_TITLE_TEXT: 'MEASURE 238 MANUAL REVIEW SCAN',

  REVIEW_SYMBOL: '⚠️',
  INFO_SYMBOL: 'ℹ️',
  CHECK_SYMBOL: '☑️'
};


// ==============================================================================
// 2. SHARED FORMULATION / ROUTE WARNINGS (from 2026 spec Table 1)
// ==============================================================================

const WARN = {
  ORAL_ONLY_DIPHENHYDRAMINE: '⚠️ Check route: ORAL only counts. Cream/gel/spray does NOT count.',
  ORAL_ONLY_BENZTROPINE: '⚠️ Check route: ORAL only counts. Injection does NOT count.',
  ATROPINE: '⚠️ Check route: Eye drops (ophthalmic) do NOT count.',
  DIPYRIDAMOLE: '⚠️ Check form: ORAL immediate-release only. Extended-release (ER, e.g. with aspirin) does NOT count.',
  NIFEDIPINE: '⚠️ Check form: Extended-release (ER/XL/CC) does NOT count.',
  ESTROGEN: '⚠️ Check route: Only ORAL or SKIN PATCH count. Vaginal cream/tablet/ring, gel, spray do NOT count.'
};


// ==============================================================================
// 3. MEASURE 238 MEDICATION DATABASE (2026 spec v10.0)
// ==============================================================================

// Word-boundary helpers used by matchOverride patterns
const WB_START = '(?:^|[^a-zA-Z0-9_])';
const WB_END = '(?:$|[^a-zA-Z0-9_])';

const MEASURE_238_DATABASE = [

  // ============================================================================
  // TABLE 1 - High-Risk Medications at Any Dose or Duration
  // ============================================================================

  // Anticholinergics, first-generation antihistamines
  { name: 'Brompheniramine', class: 'Anticholinergics - 1st-generation antihistamines', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Dimetane', 'Dimetapp', 'Bromfed'] },
  { name: 'Chlorpheniramine', class: 'Anticholinergics - 1st-generation antihistamines', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Chlor-Trimeton', 'Diabetan'] },
  { name: 'Cyproheptadine', class: 'Anticholinergics - 1st-generation antihistamines', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Periactin'] },
  {
    name: 'Dimenhydrinate', class: 'Anticholinergics - 1st-generation antihistamines', table: 'Table 1', reviewType: 'TABLE_1',
    brands: ['Dramamine', 'Driminate'],
    // "Dramamine II" / "Less Drowsy" / "All Day" = meclizine; "Non-Drowsy" = ginger
    matchOverride: new RegExp(
      WB_START +
      '(?:Dimenhydrinate|Driminate|Dramamine(?![\\s\\-]*(?:II(?![a-zA-Z0-9_])|Less[\\s\\-]+Drowsy|All[\\s\\-]+Day|Non[\\s\\-]*Drowsy)))' +
      WB_END, 'i')
  },
  { name: 'Diphenhydramine', class: 'Anticholinergics - 1st-generation antihistamines', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Benadryl', 'Sominex', 'Nytol', 'ZzzQuil', 'Diphen'], formulationWarning: WARN.ORAL_ONLY_DIPHENHYDRAMINE },
  { name: 'Doxylamine', class: 'Anticholinergics - 1st-generation antihistamines', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Unisom', 'Aldex'] },
  { name: 'Hydroxyzine', class: 'Anticholinergics - 1st-generation antihistamines', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Atarax', 'Vistaril'] },
  { name: 'Meclizine', class: 'Anticholinergics - 1st-generation antihistamines', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Antivert', 'Bonine', 'Dramamine II', 'Dramamine Less Drowsy', 'Dramamine All Day'] },
  { name: 'Promethazine', class: 'Anticholinergics - 1st-generation antihistamines', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Phenergan', 'Promethegan'] },
  { name: 'Triprolidine', class: 'Anticholinergics - 1st-generation antihistamines', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Actifed', 'Histex'] },

  // Anticholinergics, anti-Parkinson agents
  { name: 'Benztropine', class: 'Anticholinergics - Anti-Parkinson agents', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Cogentin'], formulationWarning: WARN.ORAL_ONLY_BENZTROPINE },
  { name: 'Trihexyphenidyl', class: 'Anticholinergics - Anti-Parkinson agents', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Artane'] },

  // Antispasmodics
  { name: 'Atropine', class: 'Antispasmodics', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Atropen', 'Sal-Atropine'], formulationWarning: WARN.ATROPINE },
  {
    name: 'Chlordiazepoxide-clidinium', class: 'Antispasmodics', table: 'Table 1', reviewType: 'TABLE_1',
    brands: ['Librax'],
    matchOverride: /(?:^|[^a-zA-Z0-9_])(?:Chlordiazepoxide[\s\-\/]*clidinium|Librax)(?:$|[^a-zA-Z0-9_])/i
  },
  { name: 'Dicyclomine', class: 'Antispasmodics', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Bentyl'] },
  { name: 'Hyoscyamine', class: 'Antispasmodics', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Levsin', 'Levbid', 'Anaspaz', 'Symax', 'Nulev'] },
  { name: 'Scopolamine', class: 'Antispasmodics', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Transderm-Scop', 'Maldemar', 'Scopace'] },

  // Antithrombotics
  { name: 'Dipyridamole', class: 'Antithrombotics', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Persantine'], formulationWarning: WARN.DIPYRIDAMOLE },

  // Cardiovascular
  { name: 'Guanfacine', class: 'Cardiovascular - Central alpha agonists', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Tenex', 'Intuniv'] },
  { name: 'Nifedipine', class: 'Cardiovascular - Other', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Procardia', 'Adalat'], formulationWarning: WARN.NIFEDIPINE },

  // CNS - Antidepressants
  { name: 'Amitriptyline', class: 'CNS - Antidepressants', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Elavil', 'Endep'] },
  { name: 'Amoxapine', class: 'CNS - Antidepressants', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Asendin'] },
  { name: 'Clomipramine', class: 'CNS - Antidepressants', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Anafranil'] },
  { name: 'Desipramine', class: 'CNS - Antidepressants', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Norpramin'] },
  { name: 'Imipramine', class: 'CNS - Antidepressants', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Tofranil'] },
  { name: 'Nortriptyline', class: 'CNS - Antidepressants', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Pamelor', 'Aventyl'] },
  { name: 'Paroxetine', class: 'CNS - Antidepressants', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Paxil', 'Pexeva', 'Brisdelle'] },

  // CNS - Barbiturates
  { name: 'Butalbital', class: 'CNS - Barbiturates', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Fioricet', 'Fiorinal', 'Esgic'] },
  { name: 'Phenobarbital', class: 'CNS - Barbiturates', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Luminal', 'Solfoton'] },
  { name: 'Primidone', class: 'CNS - Barbiturates', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Mysoline'] },

  // CNS - Vasodilators / Other
  { name: 'Ergoloid mesylates', class: 'CNS - Vasodilators', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Hydergine'] },
  { name: 'Meprobamate', class: 'CNS - Other', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Miltown', 'Equanil'] },

  // Endocrine - Estrogens (ONLY oral and topical patch products count)
  { name: 'Conjugated estrogen', class: 'Endocrine - Estrogens', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Premarin'], formulationWarning: WARN.ESTROGEN },
  { name: 'Esterified estrogen', class: 'Endocrine - Estrogens', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Estratab', 'Menest'], formulationWarning: WARN.ESTROGEN },
  { name: 'Estradiol', class: 'Endocrine - Estrogens', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Estrace', 'Climara', 'Vivelle-Dot', 'Minivelle', 'Estraderm'], formulationWarning: WARN.ESTROGEN },
  { name: 'Estropipate', class: 'Endocrine - Estrogens', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Ogen', 'Ortho-Est'], formulationWarning: WARN.ESTROGEN },

  // Endocrine - Other
  { name: 'Glimepiride', class: 'Endocrine - Sulfonylureas, long-duration', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Amaryl'] },
  { name: 'Glyburide', class: 'Endocrine - Sulfonylureas, long-duration', table: 'Table 1', reviewType: 'TABLE_1', brands: ['DiaBeta', 'Micronase', 'Glynase'] },
  { name: 'Desiccated thyroid', class: 'Endocrine - Desiccated thyroid', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Armour Thyroid', 'Nature-Throid', 'NP Thyroid', 'Westhroid'] },
  { name: 'Megestrol', class: 'Endocrine - Megestrol', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Megace'] },

  // Nonbenzodiazepine hypnotics
  { name: 'Eszopiclone', class: 'Nonbenzodiazepine hypnotics', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Lunesta'] },
  { name: 'Zaleplon', class: 'Nonbenzodiazepine hypnotics', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Sonata'] },
  { name: 'Zolpidem', class: 'Nonbenzodiazepine hypnotics', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Ambien', 'Edluar', 'Intermezzo', 'Zolpimist'] },

  // Pain - Skeletal muscle relaxants
  { name: 'Carisoprodol', class: 'Pain - Skeletal muscle relaxants', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Soma'] },
  { name: 'Chlorzoxazone', class: 'Pain - Skeletal muscle relaxants', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Parafon Forte', 'Lorzone'] },
  { name: 'Cyclobenzaprine', class: 'Pain - Skeletal muscle relaxants', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Flexeril', 'Amrix', 'Fexmid'] },
  { name: 'Metaxalone', class: 'Pain - Skeletal muscle relaxants', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Skelaxin'] },
  { name: 'Methocarbamol', class: 'Pain - Skeletal muscle relaxants', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Robaxin'] },
  { name: 'Orphenadrine', class: 'Pain - Skeletal muscle relaxants', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Norflex'] },

  // Pain - Meperidine / Other
  { name: 'Meperidine', class: 'Pain - Meperidine', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Demerol'] },
  { name: 'Indomethacin', class: 'Pain - Other', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Indocin', 'Tivorbex'] },
  { name: 'Ketorolac', class: 'Pain - Other', table: 'Table 1', reviewType: 'TABLE_1', brands: ['Toradol', 'Sprix'] }, // spec: includes parenteral and oral


  // ============================================================================
  // TABLE 2 - Days Supply Criteria (> 90 days)
  // ============================================================================

  { name: 'Nitrofurantoin', class: 'Anti-Infectives - Nitrofurantoin', table: 'Table 2', reviewType: 'TABLE_2', brands: ['Macrodantin', 'Macrobid', 'Furadantin'] },


  // ============================================================================
  // TABLE 3 - Average Daily Dose Criteria
  // ============================================================================

  { name: 'Digoxin', class: 'Cardiovascular - Digoxin', table: 'Table 3', reviewType: 'TABLE_3_DIGOXIN', brands: ['Lanoxin', 'Digitek'] },
  { name: 'Doxepin', class: 'Tertiary tricyclic antidepressants (TCAs)', table: 'Table 3', reviewType: 'TABLE_3_DOXEPIN', brands: ['Sinequan', 'Silenor', 'Zonalon', 'Prudoxin'] },


  // ============================================================================
  // TABLE 4 - ANTIPSYCHOTICS (Submission Criteria 2)
  // ============================================================================

  {
    name: 'Aripiprazole', class: 'Antipsychotics', table: 'Table 4', reviewType: 'TABLE_4_ANTIPSYCHOTIC',
    brands: ['Abilify'],
    // Do not match "Aripiprazole lauroxil" (separate entry below)
    matchOverride: /(?:^|[^a-zA-Z0-9_])(?:Aripiprazole(?![\s\-]*lauroxil)|Abilify)(?:$|[^a-zA-Z0-9_])/i
  },
  { name: 'Aripiprazole lauroxil', class: 'Antipsychotics', table: 'Table 4', reviewType: 'TABLE_4_ANTIPSYCHOTIC', brands: ['Aristada'] },
  { name: 'Asenapine', class: 'Antipsychotics', table: 'Table 4', reviewType: 'TABLE_4_ANTIPSYCHOTIC', brands: ['Saphris', 'Secuado'] },
  { name: 'Brexpiprazole', class: 'Antipsychotics', table: 'Table 4', reviewType: 'TABLE_4_ANTIPSYCHOTIC', brands: ['Rexulti'] },
  { name: 'Cariprazine', class: 'Antipsychotics', table: 'Table 4', reviewType: 'TABLE_4_ANTIPSYCHOTIC', brands: ['Vraylar'] },
  { name: 'Chlorpromazine', class: 'Antipsychotics', table: 'Table 4', reviewType: 'TABLE_4_ANTIPSYCHOTIC', brands: ['Thorazine'] },
  { name: 'Clozapine', class: 'Antipsychotics', table: 'Table 4', reviewType: 'TABLE_4_ANTIPSYCHOTIC', brands: ['Clozaril', 'Fazaclo', 'Versacloz'] },
  { name: 'Fluphenazine', class: 'Antipsychotics', table: 'Table 4', reviewType: 'TABLE_4_ANTIPSYCHOTIC', brands: ['Prolixin'] },
  { name: 'Haloperidol', class: 'Antipsychotics', table: 'Table 4', reviewType: 'TABLE_4_ANTIPSYCHOTIC', brands: ['Haldol'] },
  { name: 'Iloperidone', class: 'Antipsychotics', table: 'Table 4', reviewType: 'TABLE_4_ANTIPSYCHOTIC', brands: ['Fanapt'] },
  { name: 'Loxapine', class: 'Antipsychotics', table: 'Table 4', reviewType: 'TABLE_4_ANTIPSYCHOTIC', brands: ['Loxitane', 'Adasuve'] },
  { name: 'Lurasidone', class: 'Antipsychotics', table: 'Table 4', reviewType: 'TABLE_4_ANTIPSYCHOTIC', brands: ['Latuda'] },
  { name: 'Molindone', class: 'Antipsychotics', table: 'Table 4', reviewType: 'TABLE_4_ANTIPSYCHOTIC', brands: ['Moban'] },
  { name: 'Olanzapine', class: 'Antipsychotics', table: 'Table 4', reviewType: 'TABLE_4_ANTIPSYCHOTIC', brands: ['Zyprexa', 'Relprevv'] },
  { name: 'Paliperidone', class: 'Antipsychotics', table: 'Table 4', reviewType: 'TABLE_4_ANTIPSYCHOTIC', brands: ['Invega'] },
  { name: 'Perphenazine', class: 'Antipsychotics', table: 'Table 4', reviewType: 'TABLE_4_ANTIPSYCHOTIC', brands: ['Trilafon'] },
  { name: 'Pimavanserin', class: 'Antipsychotics', table: 'Table 4', reviewType: 'TABLE_4_ANTIPSYCHOTIC', brands: ['Nuplazid'] },
  { name: 'Pimozide', class: 'Antipsychotics', table: 'Table 4', reviewType: 'TABLE_4_ANTIPSYCHOTIC', brands: ['Orap'] },
  { name: 'Quetiapine', class: 'Antipsychotics', table: 'Table 4', reviewType: 'TABLE_4_ANTIPSYCHOTIC', brands: ['Seroquel'] },
  { name: 'Risperidone', class: 'Antipsychotics', table: 'Table 4', reviewType: 'TABLE_4_ANTIPSYCHOTIC', brands: ['Risperdal', 'Perseris'] },
  { name: 'Thioridazine', class: 'Antipsychotics', table: 'Table 4', reviewType: 'TABLE_4_ANTIPSYCHOTIC', brands: ['Mellaril'] },
  { name: 'Thiothixene', class: 'Antipsychotics', table: 'Table 4', reviewType: 'TABLE_4_ANTIPSYCHOTIC', brands: ['Navane'] },
  { name: 'Trifluoperazine', class: 'Antipsychotics', table: 'Table 4', reviewType: 'TABLE_4_ANTIPSYCHOTIC', brands: ['Stelazine'] },
  { name: 'Ziprasidone', class: 'Antipsychotics', table: 'Table 4', reviewType: 'TABLE_4_ANTIPSYCHOTIC', brands: ['Geodon'] },


  // ============================================================================
  // TABLE 4 - BENZODIAZEPINES (Submission Criteria 2)
  // ============================================================================

  { name: 'Alprazolam', class: 'Benzodiazepines', table: 'Table 4', reviewType: 'TABLE_4_BENZODIAZEPINE', brands: ['Xanax', 'Niravam'] },
  {
    name: 'Chlordiazepoxide', class: 'Benzodiazepines', table: 'Table 4', reviewType: 'TABLE_4_BENZODIAZEPINE',
    brands: ['Librium'],
    matchOverride: /(?:^|[^a-zA-Z0-9_])(?:Chlordiazepoxide(?![\s\-\/]*clidinium)|Librium)(?:$|[^a-zA-Z0-9_])/i
  },
  { name: 'Clobazam', class: 'Benzodiazepines', table: 'Table 4', reviewType: 'TABLE_4_BENZODIAZEPINE', brands: ['Onfi', 'Sympazan'] },
  { name: 'Clonazepam', class: 'Benzodiazepines', table: 'Table 4', reviewType: 'TABLE_4_BENZODIAZEPINE', brands: ['Klonopin'] },
  { name: 'Clorazepate', class: 'Benzodiazepines', table: 'Table 4', reviewType: 'TABLE_4_BENZODIAZEPINE', brands: ['Tranxene'] },
  { name: 'Diazepam', class: 'Benzodiazepines', table: 'Table 4', reviewType: 'TABLE_4_BENZODIAZEPINE', brands: ['Valium', 'Diastat', 'Valtoco'] },
  { name: 'Estazolam', class: 'Benzodiazepines', table: 'Table 4', reviewType: 'TABLE_4_BENZODIAZEPINE', brands: ['Prosom'] },
  { name: 'Lorazepam', class: 'Benzodiazepines', table: 'Table 4', reviewType: 'TABLE_4_BENZODIAZEPINE', brands: ['Ativan', 'Loreev'] },
  { name: 'Midazolam', class: 'Benzodiazepines', table: 'Table 4', reviewType: 'TABLE_4_BENZODIAZEPINE', brands: ['Versed', 'Nayzilam'] },
  { name: 'Oxazepam', class: 'Benzodiazepines', table: 'Table 4', reviewType: 'TABLE_4_BENZODIAZEPINE', brands: ['Serax'] },
  { name: 'Temazepam', class: 'Benzodiazepines', table: 'Table 4', reviewType: 'TABLE_4_BENZODIAZEPINE', brands: ['Restoril'] },
  { name: 'Triazolam', class: 'Benzodiazepines', table: 'Table 4', reviewType: 'TABLE_4_BENZODIAZEPINE', brands: ['Halcion'] }
];


// ==============================================================================
// 4. COMPILE MEDICATION PATTERNS
// ==============================================================================

const COMPILED_MED_PATTERNS =
  compileMedicationPatterns(MEASURE_238_DATABASE);


// ==============================================================================
// 5. GOOGLE SHEETS MENU
// ==============================================================================

function onOpen() {

  const ui = SpreadsheetApp.getUi();

  ui.createMenu('Measure 238 Scanner')
    .addItem('🔍 Scan Active Sheet', 'scanActiveSheet')
    .addSeparator()
    .addItem('🧹 Clear Highlights & Notes', 'clearHighlights')
    .addItem('🗑️ Clear Summary', 'clearSummary')
    .addSeparator()
    .addItem('ℹ️ About Scanner', 'showAbout')
    .addToUi();
}


// ==============================================================================
// 6. MAIN SCANNER
// ==============================================================================

function scanActiveSheet() {

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const startTime = new Date().getTime();

  removeSummaryFromSheet(sheet);

  const dataRange = sheet.getDataRange();
  const numRows = dataRange.getNumRows();
  const numCols = dataRange.getNumColumns();

  if (numRows === 0 || numCols === 0) {
    SpreadsheetApp.getUi().alert('The active sheet is empty.');
    return;
  }

  const displayValues = dataRange.getDisplayValues();
  const backgrounds = dataRange.getBackgrounds();
  const notes = dataRange.getNotes();

  let cellsScanned = 0;
  let matchingCellsCount = 0;

  const cellMatchList = [];
  const drugClassMap = new Map();


  // ============================================================================
  // PASS 1 - FIND MEDICATIONS
  // ============================================================================

  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {

      const cellText = displayValues[r][c];

      if (!cellText || cellText.trim() === '') {
        continue;
      }

      cellsScanned++;

      const matches = findMedicationMatches(cellText);

      if (matches.length === 0) {
        continue;
      }

      matchingCellsCount++;

      cellMatchList.push({ r: r, c: c, matches: matches });

      matches.forEach(function(match) {

        const med = match.med;
        const className = med.class;

        if (!drugClassMap.has(className)) {
          drugClassMap.set(className, {
            className: className,
            table: med.table,
            reviewType: med.reviewType,
            medsMap: new Map(),
            totalOccurrences: 0
          });
        }

        const classObj = drugClassMap.get(className);
        classObj.totalOccurrences++;

        if (!classObj.medsMap.has(med.name)) {
          classObj.medsMap.set(med.name, {
            med: med,
            count: 1,
            matchedAs: [match.matchedName]
          });
        } else {
          const medEntry = classObj.medsMap.get(med.name);
          medEntry.count++;
          if (!medEntry.matchedAs.includes(match.matchedName)) {
            medEntry.matchedAs.push(match.matchedName);
          }
        }
      });
    }
  }


  // ============================================================================
  // DETERMINE CLASS STATUS
  // ============================================================================

  let classesWithMultipleDetected = 0;

  drugClassMap.forEach(function(classObj) {

    classObj.distinctMedicationCount = classObj.medsMap.size;

    classObj.hasMultipleDetected =
      classObj.totalOccurrences >= 2 ||
      classObj.distinctMedicationCount >= 2;

    if (classObj.hasMultipleDetected) {
      classesWithMultipleDetected++;
    }

    // v2.2.0 fix: use the class-level helper (passes the med, not the class)
    classObj.manualInstructions = getManualInstructionsForClass(classObj);
  });


  // ============================================================================
  // PASS 2 - HIGHLIGHTS AND NOTES
  // ============================================================================

  cellMatchList.forEach(function(item) {

    const r = item.r;
    const c = item.c;

    const hasMultipleClass = item.matches.some(function(m) {
      return drugClassMap.get(m.med.class).hasMultipleDetected;
    });

    backgrounds[r][c] = hasMultipleClass
      ? CONFIG.HIGHLIGHT_REVIEW
      : CONFIG.HIGHLIGHT_INFO;

    const noteLines = [];

    noteLines.push(
      hasMultipleClass
        ? '⚠️ MEASURE 238 — REVIEW NEEDED'
        : 'ℹ️ MEASURE 238 — CHECK EHR HISTORY'
    );
    noteLines.push('(Blue or Yellow = both need EHR check)');
    noteLines.push('');

    item.matches.forEach(function(match) {

      const med = match.med;

      noteLines.push('💊 ' + med.name + ' (' + med.table + ')');
      noteLines.push('Class: ' + med.class);

      if (med.formulationWarning) {
        noteLines.push(med.formulationWarning);
      }

      noteLines.push('');
      noteLines.push('✅ CHECK IN EHR:');

      getShortChecklist(med.reviewType).forEach(function(line) {
        noteLines.push('☑️ ' + line);
      });

      noteLines.push('----------------------------------');
    });

    notes[r][c] = noteLines.join('\n');
  });


  // ============================================================================
  // WRITE FORMATTING
  // ============================================================================

  if (cellMatchList.length > 0) {
    dataRange.setBackgrounds(backgrounds);
    dataRange.setNotes(notes);
  }


  // ============================================================================
  // SUMMARY
  // ============================================================================

  const executionTimeSec =
    ((new Date().getTime() - startTime) / 1000).toFixed(2);

  appendSummaryReport(
    sheet,
    numRows,
    cellsScanned,
    matchingCellsCount,
    Array.from(drugClassMap.values()),
    executionTimeSec
  );


  // ============================================================================
  // USER ALERT
  // ============================================================================

  const ui = SpreadsheetApp.getUi();

  if (classesWithMultipleDetected > 0) {
    ui.alert(
      '⚠️ Review Needed',
      'Some cells need manual EHR review.\n\n' +
      'Open the yellow/blue cell notes for a quick checklist.\n\n' +
      'Both colors need the same check — just click the cell.',
      ui.ButtonSet.OK
    );
  } else if (matchingCellsCount > 0) {
    ui.alert(
      'ℹ️ Medication Found',
      'High-risk medication detected.\n\n' +
      'Open the blue cell note for a quick checklist.',
      ui.ButtonSet.OK
    );
  } else {
    ui.alert(
      '✅ Scan Complete',
      'No high-risk medications found. Nothing to review.',
      ui.ButtonSet.OK
    );
  }
}


// ==============================================================================
// 7A. SHORT CHECKLIST (for cell notes - quick glance)
// ==============================================================================

function getShortChecklist(reviewType) {

  if (reviewType === 'TABLE_1') {
    return [
      '2 orders, same class, different dates?',
      'Ordered by this provider?'
    ];
  }

  if (reviewType === 'TABLE_2') {
    return [
      '2 orders, different dates?',
      'Total days supply > 90? (exactly 90 = NO)'
    ];
  }

  if (reviewType === 'TABLE_3_DIGOXIN') {
    return [
      '2 orders, different dates?',
      'EACH order avg daily dose > 0.125 mg? (exactly 0.125 = NO)'
    ];
  }

  if (reviewType === 'TABLE_3_DOXEPIN') {
    return [
      '2 orders, different dates?',
      'EACH order avg daily dose > 6 mg? (exactly 6 = NO)'
    ];
  }

  if (reviewType === 'TABLE_4_ANTIPSYCHOTIC') {
    return [
      '2 orders, different dates?',
      'Dx schizophrenia / schizoaffective / bipolar? (Jan 1 prior year → IPSD)',
      'Dx YES → Performance Not Met (G0032). Dx NO → Performance Met (M1209)'
    ];
  }

  if (reviewType === 'TABLE_4_BENZODIAZEPINE') {
    return [
      '2 orders, different dates?',
      'Dx seizure / REM sleep behavior disorder / benzo or alcohol withdrawal / SEVERE generalized anxiety? (Jan 1 prior year → IPSD)',
      'Dx YES → Performance Not Met (G0033). Dx NO → Performance Met (M1209)'
    ];
  }

  return [
    '2 orders, different dates?',
    'Ordered by this provider?'
  ];
}


// ==============================================================================
// 7B. MANUAL REVIEW INSTRUCTIONS (detailed)
// ==============================================================================

function getManualInstructions(med, classObj) {

  const instructions = [];
  const reviewType = med.reviewType;


  // TABLE 1 -------------------------------------------------------------------
  if (reviewType === 'TABLE_1') {

    instructions.push('Check EHR order/prescription history for at least TWO orders from this same drug class.');
    instructions.push('The two qualifying orders must be on DIFFERENT dates of service.');
    instructions.push('If the class contains only one medication, check whether THAT SAME MEDICATION was ordered at least twice on different dates.');
    instructions.push('Confirm the submitting provider ordered the qualifying medication(s).');
    instructions.push('A medication previously prescribed only by another provider does not count unless the submitting provider also ordered a high-risk medication from the same class.');

    if (med.formulationWarning) {
      instructions.push('Confirm the formulation/route qualifies (see warning) before counting this medication.');
    }

    instructions.push('Diagnosis does NOT matter for Table 1.');
    instructions.push('If two qualifying orders are confirmed: Submission Criteria 1 = Performance Met (G9367).');

    return instructions;
  }


  // TABLE 2 -------------------------------------------------------------------
  if (reviewType === 'TABLE_2') {

    instructions.push('Check EHR prescription/order history for at least TWO Nitrofurantoin orders.');
    instructions.push('Confirm the qualifying orders are on DIFFERENT dates of service.');
    instructions.push('Calculate the cumulative medication duration (add medication days of each prescription; do not count gaps).');
    instructions.push('The cumulative medication duration must EXCEED 90 DAYS.');
    instructions.push('Do not assume >90 days simply because Nitrofurantoin appears in Current Medications.');
    instructions.push('Confirm the submitting provider ordered the qualifying medication(s).');
    instructions.push('If confirmed: Submission Criteria 1 = Performance Met (G9367).');

    return instructions;
  }


  // TABLE 3 - DIGOXIN -----------------------------------------------------------
  if (reviewType === 'TABLE_3_DIGOXIN') {

    instructions.push('Check EHR order/prescription history for at least TWO Digoxin orders.');
    instructions.push('Confirm the qualifying orders are on DIFFERENT dates of service.');
    instructions.push('Average daily dose = (quantity x strength) / days supply. Do NOT round.');
    instructions.push('EACH qualifying order must EXCEED 0.125 mg/day. Exactly 0.125 mg/day does NOT qualify.');
    instructions.push('Confirm the submitting provider ordered the qualifying medication(s).');
    instructions.push('If both orders meet the dose requirement: Submission Criteria 1 = Performance Met (G9367).');

    return instructions;
  }


  // TABLE 3 - DOXEPIN -----------------------------------------------------------
  if (reviewType === 'TABLE_3_DOXEPIN') {

    instructions.push('Check EHR order/prescription history for at least TWO Doxepin orders (single agent or combination product).');
    instructions.push('Confirm the qualifying orders are on DIFFERENT dates of service.');
    instructions.push('Average daily dose = (quantity x strength) / days supply. Do NOT round.');
    instructions.push('EACH qualifying order must EXCEED 6 mg/day. Exactly 6 mg/day does NOT qualify.');
    instructions.push('Confirm the submitting provider ordered the qualifying medication(s).');
    instructions.push('If both orders meet the dose requirement: Submission Criteria 1 = Performance Met (G9367).');

    return instructions;
  }


  // TABLE 4 - ANTIPSYCHOTICS ----------------------------------------------------
  if (reviewType === 'TABLE_4_ANTIPSYCHOTIC') {

    instructions.push('Check EHR order/prescription history for at least TWO antipsychotic prescriptions.');
    instructions.push('The two qualifying prescriptions must be on DIFFERENT dates of service.');
    instructions.push('Confirm the submitting provider ordered the qualifying medication(s).');
    instructions.push('Check for a diagnosis of schizophrenia, schizoaffective disorder, or bipolar disorder.');
    instructions.push('Diagnosis must be on or between January 1 of the year prior to the measurement period and the Index Prescription Start Date (IPSD).');
    instructions.push('Diagnosis present: Submission Criteria 2 = Performance Not Met (G0032).');
    instructions.push('Diagnosis NOT present: Submission Criteria 2 = Performance Met (M1209).');

    return instructions;
  }


  // TABLE 4 - BENZODIAZEPINES ---------------------------------------------------
  if (reviewType === 'TABLE_4_BENZODIAZEPINE') {

    instructions.push('Check EHR order/prescription history for at least TWO benzodiazepine prescriptions.');
    instructions.push('The two qualifying prescriptions must be on DIFFERENT dates of service.');
    instructions.push('Confirm the submitting provider ordered the qualifying medication(s).');
    instructions.push('Check for: seizure disorder, REM sleep behavior disorder, benzodiazepine withdrawal, ethanol withdrawal, or SEVERE generalized anxiety disorder.');
    instructions.push('Diagnosis must be on or between January 1 of the year prior to the measurement period and the Index Prescription Start Date (IPSD).');
    instructions.push('Diagnosis present: Submission Criteria 2 = Performance Not Met (G0033).');
    instructions.push('Diagnosis NOT present: Submission Criteria 2 = Performance Met (M1209).');

    return instructions;
  }


  return [
    'Review EHR order history for qualifying orders.',
    'Confirm different dates of service.',
    'Confirm submitting provider.',
    'Apply the applicable Measure 238 table requirements.'
  ];
}


// ==============================================================================
// 8. CLASS-LEVEL MANUAL INSTRUCTIONS
// ==============================================================================

function getManualInstructionsForClass(classObj) {

  const meds = Array.from(classObj.medsMap.values());

  if (meds.length === 0) {
    return [];
  }

  // Prefer a med that has a formulation warning so that step is included
  const withWarning = meds.find(function(m) { return m.med.formulationWarning; });

  return getManualInstructions((withWarning || meds[0]).med, classObj);
}


// ==============================================================================
// 9. MEDICATION PATTERN COMPILER
// ==============================================================================

function compileMedicationPatterns(db) {

  const compiled = [];

  db.forEach(function(entry) {

    if (entry.matchOverride) {
      compiled.push({
        regex: entry.matchOverride,
        matchedName: entry.name,
        med: entry
      });
      return;
    }

    const terms = [entry.name].concat(entry.brands || []);

    terms.forEach(function(term) {

      const escaped = term.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');

      const regex = new RegExp(
        '(?:^|[^a-zA-Z0-9_])' + escaped + '(?:$|[^a-zA-Z0-9_])',
        'i'
      );

      compiled.push({
        regex: regex,
        matchedName: term,
        med: entry
      });
    });
  });

  return compiled;
}


// ==============================================================================
// 10. MEDICATION MATCHING
// ==============================================================================

function findMedicationMatches(text) {

  if (!text || typeof text !== 'string') {
    return [];
  }

  const normalizedText = text.replace(/[\r\n\t]+/g, ' ').trim();

  if (normalizedText === '') {
    return [];
  }

  const matchedMeds = new Map();

  for (let i = 0; i < COMPILED_MED_PATTERNS.length; i++) {

    const item = COMPILED_MED_PATTERNS[i];

    if (item.regex.test(normalizedText) && !matchedMeds.has(item.med.name)) {
      matchedMeds.set(item.med.name, {
        med: item.med,
        matchedName: item.matchedName
      });
    }
  }

  return Array.from(matchedMeds.values());
}


// ==============================================================================
// 11. SUMMARY REPORT
// ==============================================================================

function appendSummaryReport(sheet, dataRows, cellsScanned, matchCells, drugClassesList, executionTime) {

  const startRow = dataRows + 3;

  const dateStr = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    'yyyy-MM-dd HH:mm:ss'
  );

  const summaryData = [
    [CONFIG.SUMMARY_MARKER, ''],
    [CONFIG.SUMMARY_TITLE_TEXT, ''],
    [CONFIG.SUMMARY_MARKER, ''],
    ['Date:', dateStr],
    ['Cells Scanned:', cellsScanned],
    ['Cells Flagged:', matchCells],
    ['Drug Classes Found:', drugClassesList.length],
    ['Result:', drugClassesList.length > 0 ? 'REVIEW REQUIRED' : 'NO HIGH-RISK MEDS FOUND'],
    ['Note:', 'Blue & Yellow both need EHR check — click cells for checklist.'],
    ['--------------------------------------------------', '']
  ];

  if (drugClassesList.length === 0) {

    summaryData.push(['Result:', 'No Measure 238 high-risk medications detected.']);

  } else {

    summaryData.push(['DETECTED MEDICATION CLASSES:', '']);
    summaryData.push(['', '']);

    drugClassesList.forEach(function(classObj) {

      const status = classObj.hasMultipleDetected ? '⚠️ Review First' : 'ℹ️ Check EHR';
      const criteria = classObj.table === 'Table 4' ? ' — Criteria 2' : ' — Criteria 1';

      summaryData.push([classObj.className + ' (' + classObj.table + criteria + ')', status]);

      Array.from(classObj.medsMap.values()).forEach(function(m) {

        summaryData.push(['   💊 ' + m.med.name, 'x' + m.count]);

        if (m.med.formulationWarning) {
          summaryData.push(['      ' + m.med.formulationWarning, '']);
        }
      });

      getShortChecklist(classObj.reviewType).forEach(function(line) {
        summaryData.push(['   ☑️ ' + line, '']);
      });

      summaryData.push(['', '']);
    });
  }

  summaryData.push([CONFIG.SUMMARY_MARKER, '']);

  const rows = summaryData.length;
  const summaryRange = sheet.getRange(startRow, 1, rows, 2);

  summaryRange.setValues(summaryData);

  // Formatting
  sheet.getRange(startRow + 1, 1).setFontWeight('bold').setFontSize(11);

  [startRow + 3, startRow + 4, startRow + 5, startRow + 6, startRow + 7, startRow + 8]
    .forEach(function(row) {
      sheet.getRange(row, 1).setFontWeight('bold');
    });

  summaryRange.setWrap(true);
  summaryRange.setVerticalAlignment('top');

  sheet.autoResizeColumn(1);
  sheet.autoResizeColumn(2);
}


// ==============================================================================
// 12. REMOVE PREVIOUS SUMMARY
// ==============================================================================

function removeSummaryFromSheet(sheet) {

  const lastRow = sheet.getLastRow();

  if (lastRow === 0) {
    return;
  }

  const firstColValues = sheet.getRange(1, 1, lastRow, 1).getDisplayValues();

  let summaryStartRow = -1;

  for (let r = 0; r < firstColValues.length; r++) {
    if (firstColValues[r][0] === CONFIG.SUMMARY_MARKER) {
      summaryStartRow = r + 1;
      break;
    }
  }

  if (summaryStartRow !== -1) {

    const rowsToClear = lastRow - summaryStartRow + 1;
    const range = sheet.getRange(summaryStartRow, 1, rowsToClear, sheet.getMaxColumns());

    range.clearContent();
    range.clearFormat();
  }
}


// ==============================================================================
// 13. CLEAR HIGHLIGHTS
// ==============================================================================

function clearHighlights() {

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const dataRange = sheet.getDataRange();

  if (dataRange.getNumRows() === 0) {
    return;
  }

  dataRange.setBackground(null);
  dataRange.clearNote();

  SpreadsheetApp.getUi().alert('🧹 Highlights and notes cleared successfully.');
}


// ==============================================================================
// 14. CLEAR SUMMARY
// ==============================================================================

function clearSummary() {

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  removeSummaryFromSheet(sheet);

  SpreadsheetApp.getUi().alert('🗑️ Scan summary cleared successfully.');
}


// ==============================================================================
// 15. ABOUT
// ==============================================================================

function showAbout() {

  const ui = SpreadsheetApp.getUi();

  const message =
    'Measure 238 Scanner — v' + CONFIG.VERSION + '\n' +
    '(2026 MIPS CQM spec v10.0)\n\n' +

    'What it does:\n' +
    'Scans pasted Current Meds and flags high-risk drugs.\n\n' +

    'What it does NOT do:\n' +
    'It can\'t confirm the measure by itself. Always check EHR order history.\n\n' +

    'Colors:\n' +
    '⚠️ Yellow = 2+ meds/orders already seen — review first\n' +
    'ℹ️ Blue = 1 med seen — still check EHR, may have older orders\n\n' +

    'Criteria:\n' +
    'Tables 1-3 = Criteria 1 (used for MIPS score). Diagnosis does not matter.\n' +
    'Table 4 = Criteria 2. Appropriate diagnosis = Performance Not Met.\n\n' +

    'Click any flagged cell to see a short checklist.';

  ui.alert('About Measure 238 Scanner', message, ui.ButtonSet.OK);
}