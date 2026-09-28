export type Language = 'en' | 'bn';

export interface Translations {
  // Common Navigation
  dashboard: string;
  dashboardSub: string;
  pos: string;
  posSub: string;
  menuItems: string;
  menuItemsSub: string;
  sales: string;
  salesSub: string;
  expenses: string;
  expensesSub: string;
  purchases: string;
  purchasesSub: string;
  payables: string;
  payablesSub: string;
  receivables: string;
  receivablesSub: string;
  rawMaster: string;
  rawMasterSub: string;
  invItems: string;
  invItemsSub: string;
  inventory: string;
  inventorySub: string;
  reports: string;
  reportsSub: string;
  users: string;
  usersSub: string;
  heads: string;
  headsSub: string;
  configs: string;
  configsSub: string;
  dataCleanup: string;
  dataCleanupSub: string;

  // Header & System
  brandTitle: string;
  brandTagline: string;
  restaurantProfile: string;
  restaurantProfileSub: string;
  logoUpload: string;
  logoPresets: string;
  logoPreview: string;
  saveProfile: string;
  aiChef: string;
  liveFloor: string;
  activeShift: string;
  openSession: string;
  closeSession: string;
  loggedAs: string;
  switchUser: string;
  logout: string;
  manageUsers: string;

  // POS & Tables
  allZones: string;
  freeTables: string;
  occupiedTables: string;
  billedTables: string;
  table: string;
  zone: string;
  waiter: string;
  guest: string;
  runningItems: string;
  orderTotal: string;
  settleBill: string;
  kotPrint: string;
  guestBill: string;
  clearTable: string;
  addTable: string;
  addZone: string;
  emptyTableMessage: string;
  sessionLockedTitle: string;
  sessionLockedDesc: string;
  openShiftBtn: string;
  shiftSales: string;
  expectedDrawerCash: string;
  closeShiftZReport: string;

  // Shift Modals
  openShiftModalTitle: string;
  openingCashFloat: string;
  openingCashHelp: string;
  openingCash: string;
  cashierName: string;
  cashier: string;
  startShiftConfirm: string;
  closeShiftModalTitle: string;
  actualCountedCash: string;
  countHelp: string;
  varianceMatched: string;
  varianceShortage: string;
  varianceSurplus: string;
  reconcileAndClose: string;
  zReportTitle: string;
  printReceipt: string;
  close: string;

  // Status & Actions
  status: string;
  active: string;
  completed: string;
  pending: string;
  save: string;
  cancel: string;
  delete: string;
  edit: string;
  search: string;
  filter: string;
  exportCsv: string;
  print: string;
  total: string;
  subtotal: string;
  vatTax: string;
  discount: string;
  grandTotal: string;
  paid: string;
  due: string;
  change: string;
}

export const translations: Record<Language, Translations> = {
  en: {
    // Common Navigation
    dashboard: 'Executive Dashboard',
    dashboardSub: 'Business Overview',
    pos: 'Live Tables & POS',
    posSub: 'Floor Plan & Billing',
    menuItems: 'Menu & Recipe (BOM)',
    menuItemsSub: 'Menu & Costing Engine',
    sales: 'Sales & Customer Dues',
    salesSub: 'Sales Register & Ledger',
    expenses: 'Operating Expenses',
    expensesSub: 'Daily Expenses Ledger',
    purchases: 'Purchases & Inward',
    purchasesSub: 'Vouchers & Bill Breakdown',
    payables: 'Vendor Payables',
    payablesSub: 'Bill-wise Settlement',
    receivables: 'Customer Receivables',
    receivablesSub: 'Customer Dues Ledger',
    invItems: 'Raw Materials Master',
    invItemsSub: 'Ingredients & Inventory Master',
    rawMaster: 'Raw Materials Master',
    rawMasterSub: 'Ingredients & Inventory Master',
    inventory: 'Stock Ledger & Valuation',
    inventorySub: 'Auto BOM & Wastage',
    reports: 'Reports & Analytics',
    reportsSub: 'Sales, Profit, Stock & Dues',
    users: 'Users & Roles (RBAC)',
    usersSub: 'Access Permissions',
    heads: 'Master Configurations',
    headsSub: 'Tables, Staff & Profiles',
    configs: 'System Configurations',
    configsSub: 'Tables, Staff & Setup',
    dataCleanup: 'Data Cleanup & Reset',
    dataCleanupSub: 'Module-wise & Backup',

    // Header & System
    brandTitle: 'Restaurant POS',
    brandTagline: 'Restaurant POS & Recipe BOM ERP',
    restaurantProfile: 'Restaurant Profile & Logo',
    restaurantProfileSub: 'Logo branding, branch address & tax info',
    logoUpload: 'Upload Restaurant Logo',
    logoPresets: 'Preset Icons',
    logoPreview: 'Logo & Receipt Preview',
    saveProfile: 'Save Profile & Branding',
    aiChef: 'AI Chef & Costing',
    liveFloor: 'Floor',
    activeShift: 'Active Shift',
    openSession: 'Open Shift',
    closeSession: 'Close Shift',
    loggedAs: 'Logged in as',
    switchUser: 'Switch Active Operator',
    logout: 'Log Out',
    manageUsers: 'Manage Users & Roles (RBAC)',

    // POS & Tables
    allZones: 'All Zones / Floors',
    freeTables: 'Free',
    occupiedTables: 'Occupied',
    billedTables: 'Billed',
    table: 'Table',
    zone: 'Zone',
    waiter: 'Waiter',
    guest: 'Guest / Customer',
    runningItems: 'Running Items',
    orderTotal: 'Order Total',
    settleBill: 'Settle Bill',
    kotPrint: 'Print KOT',
    guestBill: 'Guest Bill',
    clearTable: 'Clear Table',
    addTable: 'Add Table',
    addZone: 'Add Zone',
    emptyTableMessage: 'No orders added yet. Click items to build cart.',
    sessionLockedTitle: 'POS Shift Session is Closed',
    sessionLockedDesc: 'You must open a shift session before taking table orders or settling bills.',
    openShiftBtn: 'Open POS Shift Session',
    shiftSales: 'Shift Sales',
    expectedDrawerCash: 'Expected Drawer Cash',
    closeShiftZReport: 'Close Shift & Z-Report',

    // Shift Modals
    openShiftModalTitle: 'Open POS Shift Session',
    openingCashFloat: 'Opening Cash Float (৳)',
    openingCashHelp: 'Enter initial cash drawer balance before taking orders.',
    openingCash: 'Opening Cash (৳)',
    cashierName: 'Cashier / Operator Name',
    cashier: 'Cashier',
    startShiftConfirm: 'Start Shift & Unlock POS',
    closeShiftModalTitle: 'Close Shift & Cash Drawer Reconciliation',
    actualCountedCash: 'Actual Counted Cash in Drawer (৳)',
    countHelp: 'Count physical notes and coins in cash drawer.',
    varianceMatched: 'Drawer Cash Matched Perfectly (৳0.00)',
    varianceShortage: 'Cash Shortage Detected',
    varianceSurplus: 'Cash Surplus / Excess',
    reconcileAndClose: 'Submit Z-Report & Close Shift',
    zReportTitle: 'POS Shift End Z-Report',
    printReceipt: 'Print Receipt',
    close: 'Close',

    // Status & Actions
    status: 'Status',
    active: 'Active',
    completed: 'Completed',
    pending: 'Pending',
    save: 'Save Changes',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    search: 'Search...',
    filter: 'Filter',
    exportCsv: 'Export CSV',
    print: 'Print',
    total: 'Total',
    subtotal: 'Subtotal',
    vatTax: 'VAT / Tax',
    discount: 'Discount',
    grandTotal: 'Grand Total',
    paid: 'Paid Amount',
    due: 'Due Amount',
    change: 'Change Return'
  },
  bn: {
    // Common Navigation
    dashboard: 'Executive Dashboard',
    dashboardSub: 'Business Overview',
    pos: 'Live Tables & POS',
    posSub: 'Floor Plan & Billing',
    menuItems: 'Menu & Recipe (BOM)',
    menuItemsSub: 'Menu & Costing Engine',
    sales: 'Sales & Customer Dues',
    salesSub: 'Sales Register & Ledger',
    expenses: 'Operating Expenses',
    expensesSub: 'Daily Expenses Ledger',
    purchases: 'Purchases & Inward',
    purchasesSub: 'Vouchers & Bill Breakdown',
    payables: 'Vendor Payables',
    payablesSub: 'Bill-wise Settlement',
    receivables: 'Customer Receivables',
    receivablesSub: 'Customer Dues Ledger',
    invItems: 'Raw Materials Master',
    invItemsSub: 'Ingredients & Inventory Master',
    rawMaster: 'Raw Materials Master',
    rawMasterSub: 'Ingredients & Inventory Master',
    inventory: 'Stock Ledger & Valuation',
    inventorySub: 'Auto BOM & Wastage',
    reports: 'Reports & Analytics',
    reportsSub: 'Sales, Profit, Stock & Dues',
    users: 'Users & Roles (RBAC)',
    usersSub: 'Access Permissions',
    heads: 'Master Configurations',
    headsSub: 'Tables, Staff & Profiles',
    configs: 'System Configurations',
    configsSub: 'Tables, Staff & Setup',
    dataCleanup: 'Data Cleanup & Reset',
    dataCleanupSub: 'Module-wise & Backup',

    // Header & System
    brandTitle: 'Restaurant POS',
    brandTagline: 'Restaurant POS & Recipe BOM ERP',
    restaurantProfile: 'Restaurant Profile & Logo',
    restaurantProfileSub: 'Logo branding, branch address & tax info',
    logoUpload: 'Upload Restaurant Logo',
    logoPresets: 'Preset Icons',
    logoPreview: 'Logo & Receipt Preview',
    saveProfile: 'Save Profile & Branding',
    aiChef: 'AI Chef & Costing',
    liveFloor: 'Floor',
    activeShift: 'Active Shift',
    openSession: 'Open Shift',
    closeSession: 'Close Shift',
    loggedAs: 'Logged in as',
    switchUser: 'Switch Active Operator',
    logout: 'Log Out',
    manageUsers: 'Manage Users & Roles (RBAC)',

    // POS & Tables
    allZones: 'All Zones / Floors',
    freeTables: 'Free',
    occupiedTables: 'Occupied',
    billedTables: 'Billed',
    table: 'Table',
    zone: 'Zone',
    waiter: 'Waiter',
    guest: 'Guest / Customer',
    runningItems: 'Running Items',
    orderTotal: 'Order Total',
    settleBill: 'Settle Bill',
    kotPrint: 'Print KOT',
    guestBill: 'Guest Bill',
    clearTable: 'Clear Table',
    addTable: 'Add Table',
    addZone: 'Add Zone',
    emptyTableMessage: 'No orders added yet. Click items to build cart.',
    sessionLockedTitle: 'POS Shift Session is Closed',
    sessionLockedDesc: 'You must open a shift session before taking table orders or settling bills.',
    openShiftBtn: 'Open POS Shift Session',
    shiftSales: 'Shift Sales',
    expectedDrawerCash: 'Expected Drawer Cash',
    closeShiftZReport: 'Close Shift & Z-Report',

    // Shift Modals
    openShiftModalTitle: 'Open POS Shift Session',
    openingCashFloat: 'Opening Cash Float (৳)',
    openingCashHelp: 'Enter initial cash drawer balance before taking orders.',
    openingCash: 'Opening Cash (৳)',
    cashierName: 'Cashier / Operator Name',
    cashier: 'Cashier',
    startShiftConfirm: 'Start Shift & Unlock POS',
    closeShiftModalTitle: 'Close Shift & Cash Drawer Reconciliation',
    actualCountedCash: 'Actual Counted Cash in Drawer (৳)',
    countHelp: 'Count physical notes and coins in cash drawer.',
    varianceMatched: 'Drawer Cash Matched Perfectly (৳0.00)',
    varianceShortage: 'Cash Shortage Detected',
    varianceSurplus: 'Cash Surplus / Excess',
    reconcileAndClose: 'Submit Z-Report & Close Shift',
    zReportTitle: 'POS Shift End Z-Report',
    printReceipt: 'Print Receipt',
    close: 'Close',

    // Status & Actions
    status: 'Status',
    active: 'Active',
    completed: 'Completed',
    pending: 'Pending',
    save: 'Save Changes',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    search: 'Search...',
    filter: 'Filter',
    exportCsv: 'Export CSV',
    print: 'Print',
    total: 'Total',
    subtotal: 'Subtotal',
    vatTax: 'VAT / Tax',
    discount: 'Discount',
    grandTotal: 'Grand Total',
    paid: 'Paid Amount',
    due: 'Due Amount',
    change: 'Change Return'
  }
};
