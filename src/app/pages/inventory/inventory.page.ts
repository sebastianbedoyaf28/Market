import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController, AlertController } from '@ionic/angular';
import { Router } from '@angular/router';
import { Product, ProductService, ProductSearchFilters, ProductStatusCount } from '../../services/product.service';
import { InventoryService } from '../../services/inventory.service';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './inventory.page.html',
  styleUrls: ['./inventory.page.scss'],
})
export class InventoryPage implements OnInit {
  products: Product[] = [];
  filteredProducts: Product[] = [];
  loading = false;
  
  // Filtros avanzados
  searchFilters: ProductSearchFilters = {
    searchTerm: '',
    category: '',
    minPrice: undefined,
    maxPrice: undefined,
    productStatus: undefined,
    sortBy: 'name',
    sortDirection: 'asc',
    limit: 100
  };

  // Opciones de filtros
  categories: string[] = [];
  priceRange = { min: 0, max: 1000 };
  productStatusOptions = [
    { value: '', label: 'Todos los estados' },
    { value: 'normal', label: 'Stock Normal' },
    { value: 'stock_bajo', label: 'Stock Bajo' },
    { value: 'agotado', label: 'Agotado' },
    { value: 'proximo_vencer', label: 'Próximo a Vencer' }
  ];

  sortOptions = [
    { value: 'name', label: 'Nombre (A-Z)' },
    { value: 'name_desc', label: 'Nombre (Z-A)' },
    { value: 'price_asc', label: 'Precio (Menor a Mayor)' },
    { value: 'price_desc', label: 'Precio (Mayor a Menor)' },
    { value: 'stock_asc', label: 'Stock (Menor a Mayor)' },
    { value: 'stock_desc', label: 'Stock (Mayor a Menor)' },
    { value: 'category', label: 'Categoría' }
  ];

  // Estados de filtros
  showAdvancedFilters = false;
  statusCounts: ProductStatusCount = {
    total: 0,
    stock_bajo: 0,
    agotado: 0,
    proximo_vencer: 0,
    normal: 0
  };

  constructor(
    private productService: ProductService,
    private inventoryService: InventoryService,
    private toast: ToastController,
    private alert: AlertController,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadInitialData();
  }

  async loadInitialData() {
    this.loading = true;
    try {
      // Primero cargar productos básicos para verificar conexión
      console.log('Cargando productos...');
      this.products = await this.productService.getProducts();
      console.log('Productos cargados:', this.products.length);
      
      // Mostrar productos directamente sin filtros inicialmente
      this.filteredProducts = [...this.products];
      
      // Cargar datos adicionales en paralelo
      try {
        const [categories, priceRange] = await Promise.all([
          this.productService.getCategories(),
          this.productService.getPriceRange()
        ]);

        this.categories = categories;
        this.priceRange = priceRange;
        
        // Actualizar filtros con el rango de precios
        this.searchFilters.minPrice = this.priceRange.min;
        this.searchFilters.maxPrice = this.priceRange.max;
        
        console.log('Categorías:', this.categories);
        console.log('Rango de precios:', this.priceRange);
      } catch (error) {
        console.warn('Error cargando datos adicionales:', error);
        // Continuar sin datos adicionales
      }

      this.calculateStatusCounts();
    } catch (error) {
      await this.showToast('Error al cargar productos', 'danger');
      console.error('Error loading products:', error);
    } finally {
      this.loading = false;
    }
  }

  async searchProducts() {
    this.loading = true;
    try {
      this.filteredProducts = await this.productService.searchProducts(this.searchFilters);
      this.calculateStatusCounts();
    } catch (error) {
      await this.showToast('Error en la búsqueda', 'danger');
      console.error('Error searching products:', error);
    } finally {
      this.loading = false;
    }
  }

  calculateStatusCounts() {
    this.statusCounts = {
      total: this.products.length,
      stock_bajo: 0,
      agotado: 0,
      proximo_vencer: 0,
      normal: 0
    };

    this.products.forEach(product => {
      const stock = product.stock || 0;
      const minStock = product.minStock || 0;
      const isExpiring = this.isProductExpiring(product);

      if (stock === 0) {
        this.statusCounts.agotado++;
      } else if (isExpiring) {
        this.statusCounts.proximo_vencer++;
      } else if (stock <= minStock) {
        this.statusCounts.stock_bajo++;
      } else {
        this.statusCounts.normal++;
      }
    });
  }

  isProductExpiring(product: Product): boolean {
    if (!product.expiryDate) return false;
    
    const expiryDate = new Date(product.expiryDate);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    
    return expiryDate <= futureDate && (product.stock || 0) > 0;
  }

  // Eventos de filtros
  onSearchChange(event: any) {
    this.searchFilters.searchTerm = event.detail.value;
    this.searchProducts();
  }

  onCategoryChange(event: any) {
    this.searchFilters.category = event.detail.value;
    this.searchProducts();
  }

  onStatusChange(event: any) {
    this.searchFilters.productStatus = event.detail.value || undefined;
    this.searchProducts();
  }

  onSortChange(event: any) {
    const sortValue = event.detail.value;
    if (sortValue.includes('_desc')) {
      this.searchFilters.sortBy = sortValue.replace('_desc', '') as any;
      this.searchFilters.sortDirection = 'desc';
    } else {
      this.searchFilters.sortBy = sortValue.replace('_asc', '') as any;
      this.searchFilters.sortDirection = 'asc';
    }
    this.searchProducts();
  }

  onPriceRangeChange() {
    // Validar que min <= max
    if (this.searchFilters.minPrice && this.searchFilters.maxPrice) {
      if (this.searchFilters.minPrice > this.searchFilters.maxPrice) {
        this.showToast('El precio mínimo no puede ser mayor al máximo', 'warning');
        return;
      }
    }
    this.searchProducts();
  }

  toggleAdvancedFilters() {
    this.showAdvancedFilters = !this.showAdvancedFilters;
  }

  clearFilters() {
    this.searchFilters = {
      searchTerm: '',
      category: '',
      minPrice: this.priceRange.min,
      maxPrice: this.priceRange.max,
      productStatus: undefined,
      sortBy: 'name',
      sortDirection: 'asc',
      limit: 100
    };
    this.searchProducts();
  }

  applyQuickFilter(status: string) {
    this.searchFilters.productStatus = status as any;
    this.searchProducts();
  }

  async addProduct() {
    // Implementar modal para agregar producto
    await this.showToast('Funcionalidad de agregar producto', 'primary');
  }

  async editProduct(product: Product) {
    // Implementar modal para editar producto
    await this.showToast(`Editando producto: ${product.name}`, 'primary');
  }

  async deleteProduct(product: Product) {
    const alert = await this.alert.create({
      header: 'Confirmar eliminación',
      message: `¿Estás seguro de eliminar el producto "${product.name}"?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Eliminar',
          handler: async () => {
            try {
              await this.productService.remove(product.id);
              await this.showToast('Producto eliminado exitosamente', 'success');
              this.searchProducts();
            } catch (error) {
              await this.showToast('Error al eliminar producto', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async viewStock(product: Product) {
    // Implementar vista de stock por lotes
    await this.showToast(`Viendo stock de: ${product.name}`, 'primary');
  }

  async exportInventory() {
    try {
      const data = this.filteredProducts.map(product => ({
        SKU: product.sku || '',
        Nombre: product.name,
        Categoría: product.category || '',
        'Precio Costo': product.costPrice || 0,
        'Precio Venta': product.price,
        Stock: product.stock || 0,
        'Fecha Caducidad': product.expiryDate || 'N/A'
      }));

      // Crear CSV
      const csvContent = this.convertToCSV(data);
      this.downloadCSV(csvContent, 'inventario.csv');
      
      await this.showToast('Inventario exportado exitosamente', 'success');
    } catch (error) {
      await this.showToast('Error al exportar inventario', 'danger');
    }
  }

  private convertToCSV(data: any[]): string {
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => `"${row[header]}"`).join(',')
      )
    ];
    return csvRows.join('\n');
  }

  private downloadCSV(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'primary' | 'warning') {
    const toast = await this.toast.create({
      message,
      duration: 2000,
      position: 'top',
      color
    });
    await toast.present();
  }

  getStockStatus(product: Product): { status: string; color: string } {
    const stock = product.stock || 0;
    const minStock = product.minStock || 0;
    
    if (stock === 0) {
      return { status: 'Sin Stock', color: 'danger' };
    } else if (stock <= minStock) {
      return { status: 'Stock Bajo', color: 'warning' };
    } else {
      return { status: 'En Stock', color: 'success' };
    }
  }

  getTotalStock(): number {
    return this.filteredProducts.reduce((total, product) => total + (product.stock || 0), 0);
  }

  getLowStockCount(): number {
    return this.filteredProducts.filter(product => {
      const stock = product.stock || 0;
      const minStock = product.minStock || 0;
      return stock <= minStock && stock > 0;
    }).length;
  }

  getTotalValue(): number {
    return this.filteredProducts.reduce((total, product) => {
      const stock = product.stock || 0;
      const costPrice = product.costPrice || 0;
      return total + (stock * costPrice);
    }, 0);
  }

  // Métodos para filtros avanzados
  getStatusColor(status: string): string {
    switch (status) {
      case 'normal': return 'success';
      case 'stock_bajo': return 'warning';
      case 'agotado': return 'danger';
      case 'proximo_vencer': return 'warning';
      default: return 'medium';
    }
  }

  getStatusCount(status: string): number {
    switch (status) {
      case 'normal': return this.statusCounts.normal;
      case 'stock_bajo': return this.statusCounts.stock_bajo;
      case 'agotado': return this.statusCounts.agotado;
      case 'proximo_vencer': return this.statusCounts.proximo_vencer;
      default: return 0;
    }
  }

  getCurrentSortValue(): string {
    if (this.searchFilters.sortDirection === 'desc') {
      return `${this.searchFilters.sortBy}_desc`;
    } else {
      return `${this.searchFilters.sortBy}_asc`;
    }
  }

  onMinPriceChange(event: any) {
    const value = event.detail.value;
    this.searchFilters.minPrice = value ? parseFloat(value) : undefined;
    this.onPriceRangeChange();
  }

  onMaxPriceChange(event: any) {
    const value = event.detail.value;
    this.searchFilters.maxPrice = value ? parseFloat(value) : undefined;
    this.onPriceRangeChange();
  }
}
