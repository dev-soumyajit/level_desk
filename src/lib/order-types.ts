export type LineItem = { sku: string; quantity: string; size: string; color: string };
export type Payment = 'Unknown' | 'Prepaid' | 'COD';
export type Marketplace = 'Unknown' | 'Flipkart' | 'Meesho' | 'Amazon' | 'Other';
export type OrderMetadata = {
  orderId?: string; trackingId?: string; payment?: Payment; marketplace?: Marketplace;
  items?: LineItem[]; packed?: boolean; exportedAt?: string; notes?: string; fingerprint?: string;
};
