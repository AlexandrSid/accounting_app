export const rowSchemas = [
  {
    sheetName: 'contributors',
    columns: [
      { key: 'id', label: 'ID', type: 'text' },
      { key: 'username', label: 'Username', type: 'text' },
      { key: 'last_name', label: 'Last Name', type: 'text' },
      { key: 'phone_number', label: 'Phone Number', type: 'text' },
      { key: 'contribution_amount', label: 'Contribution Amount', type: 'text' },
    ],
  },
  {
    sheetName: 'period_transactions',
    columns: [
      { key: 'id', label: 'ID', type: 'text' },
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'amount', label: 'Amount', type: 'number' },
      { key: 'currency', label: 'Currency', type: 'text' },
      { key: 'contributor_id', label: 'Contributor ID / Name', type: 'text' },
      { key: 'marker', label: 'Marker (contribution|donation|extraction)', type: 'text' },
      { key: 'document_ref', label: 'Document Reference (optional)', type: 'text' },
    ],
  },
  {
    sheetName: 'period_initial_balances',
    columns: [
      { key: 'currency', label: 'Currency', type: 'text' },
      { key: 'amount', label: 'Initial Balance Amount', type: 'number' },
    ],
  },
];
