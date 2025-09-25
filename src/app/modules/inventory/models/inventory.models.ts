export type StockStatus = 'SUFFICIENT' | 'LOW' | 'OUT' | 'EXPIRING';

export interface InventoryFilters {
  search?: string;
  category?: string;
  provider?: string;
  expiryFrom?: string;
  expiryTo?: string;
  status?: StockStatus;
}

export interface InventoryLot {
  id: string;
  lotNumber: string;
  quantity: number;
  expiryDate?: string | null;
  provider?: string | null;
  createdAt: string;
}

export interface InventoryLotInput {
  id?: string;
  lotNumber: string;
  quantity: number;
  expiryDate?: string | null;
  provider?: string | null;
}

export interface StockMovement {
  id: string;
  productId: string;
  lotId?: string | null;
  type: 'IN' | 'OUT';
  reason: 'purchase' | 'sale' | 'adjustment' | 'waste';
  quantity: number;
  note?: string | null;
  createdAt: string;
}

export interface InventoryProduct {
  id: string;
  name: string;
  sku: string;
  category: string;
  provider: string;
  costPrice: number;
  salePrice: number;
  imageUrl?: string | null;
  lots: InventoryLot[];
  movements: StockMovement[];
  totalStock: number;
  status: StockStatus;
  nextExpiryDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInventoryProductDto {
  name: string;
  sku: string;
  category: string;
  provider: string;
  costPrice: number;
  salePrice: number;
  imageUrl?: string | null;
  lots: InventoryLotInput[];
}

export interface UpdateInventoryProductDto extends Partial<CreateInventoryProductDto> {}

export interface RecordMovementDto {
  productId: string;
  lotId?: string | null;
  type: 'IN' | 'OUT';
  reason: 'purchase' | 'sale' | 'adjustment' | 'waste';
  quantity: number;
  note?: string | null;
  newLot?: {
    lotNumber: string;
    expiryDate?: string | null;
    provider?: string | null;
  };
}
