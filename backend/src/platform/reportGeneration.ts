export interface GenerateReportSourceDataRequiredResult {
  success: false;
  code: 'source_data_required';
  message: string;
  report_type: string;
  title: string;
  period?: string;
}

export function buildGenerateReportResult(input: {
  report_type?: string;
  title?: string;
  period?: string;
}) : GenerateReportSourceDataRequiredResult {
  return {
    success: false,
    code: 'source_data_required',
    message: 'Report generation requires source-backed query data. Run query_data first.',
    report_type: typeof input.report_type === 'string' ? input.report_type : 'executive_summary',
    title: typeof input.title === 'string' && input.title.trim() ? input.title.trim() : 'Generated report',
    period: typeof input.period === 'string' && input.period.trim() ? input.period.trim() : undefined,
  };
}
