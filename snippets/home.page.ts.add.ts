// Add to your existing HomePage
import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { Product, ProductService } from '../../services/product.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss']
})
export class HomePage implements OnInit {
  products$!: Observable<Product[]>;

  constructor(private products: ProductService) {}

  ngOnInit() {
    this.products$ = this.products.list();
  }
}
