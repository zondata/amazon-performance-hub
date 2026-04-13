import { SpApiConfigError, type SpApiRegion } from './types';

export const LWA_TOKEN_ENDPOINT = 'https://api.amazon.com/auth/o2/token';
export const SELLERS_MARKETPLACE_PARTICIPATIONS_PATH =
  '/sellers/v1/marketplaceParticipations';
export const REPORTS_CREATE_REPORT_PATH = '/reports/2021-06-30/reports';
export const buildReportsGetReportPath = (reportId: string) =>
  `${REPORTS_CREATE_REPORT_PATH}/${encodeURIComponent(reportId)}`;
export const buildReportsGetReportDocumentPath = (reportDocumentId: string) =>
  `/reports/2021-06-30/documents/${encodeURIComponent(reportDocumentId)}`;

export const SP_API_ENDPOINTS: Record<SpApiRegion, string> = {
  na: 'https://sellingpartnerapi-na.amazon.com',
  eu: 'https://sellingpartnerapi-eu.amazon.com',
  fe: 'https://sellingpartnerapi-fe.amazon.com',
};

export const resolveSpApiEndpoint = (region: SpApiRegion | string) => {
  const endpoint = SP_API_ENDPOINTS[region as SpApiRegion];

  if (!endpoint) {
    throw new SpApiConfigError(
      'invalid_region',
      `Unsupported SP-API region: ${region}`,
      { received: region }
    );
  }

  return endpoint;
};
