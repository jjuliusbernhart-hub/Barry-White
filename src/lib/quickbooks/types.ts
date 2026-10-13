export type QboReference = {
  value?: string;
  name?: string;
};

export type QboItem = {
  Id: string;
  SyncToken?: string;
  Name: string;
  Sku?: string;
  Active?: boolean;
  Type?: string;
  TrackQtyOnHand?: boolean;
  QtyOnHand?: number;
  PurchaseCost?: number;
  UnitPrice?: number;
  MetaData?: {
    LastUpdatedTime?: string;
  };
};

export type QboLine = {
  Id?: string;
  LineNum?: number;
  Description?: string;
  DetailType?: string;
  Amount?: number;
  ItemBasedExpenseLineDetail?: {
    ItemRef?: QboReference;
    Qty?: number;
    UnitPrice?: number;
  };
  AccountBasedExpenseLineDetail?: {
    AccountRef?: QboReference;
  };
};

export type QboTransaction = {
  Id: string;
  SyncToken?: string;
  TxnDate?: string;
  DocNumber?: string;
  TotalAmt?: number;
  CurrencyRef?: QboReference;
  VendorRef?: QboReference;
  Line?: QboLine[];
  MetaData?: {
    LastUpdatedTime?: string;
  };
};

export type QboTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in?: number;
  token_type: "bearer";
};

export type QboReport = {
  Header?: {
    Time?: string;
    ReportName?: string;
    EndPeriod?: string;
  };
  Columns?: {
    Column?: Array<{
      ColTitle?: string;
      ColType?: string;
    }>;
  };
  Rows?: {
    Row?: QboReportRow[];
  };
};

export type QboReportRow = {
  type?: string;
  ColData?: Array<{
    value?: string;
    id?: string;
  }>;
  Rows?: {
    Row?: QboReportRow[];
  };
};
