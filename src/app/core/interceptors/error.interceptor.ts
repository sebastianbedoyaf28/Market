import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { ToastController } from '@ionic/angular';
import { Router } from '@angular/router';

/**
 * HTTP Error Interceptor
 * Handles HTTP errors globally and provides consistent error handling
 */
@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  
  constructor(
    private toastController: ToastController,
    private router: Router
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      retry(1), // Retry failed requests once
      catchError((error: HttpErrorResponse) => this.handleError(error))
    );
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Ha ocurrido un error inesperado';
    let shouldShowToast = true;

    switch (error.status) {
      case 0:
        errorMessage = 'Error de conexión. Verifica tu conexión a internet.';
        break;
      
      case 400:
        errorMessage = error.error?.message || 'Datos inválidos en la solicitud';
        break;
      
      case 401:
        errorMessage = 'Sesión expirada. Por favor, inicia sesión nuevamente.';
        this.router.navigate(['/login']);
        break;
      
      case 403:
        errorMessage = 'No tienes permisos para realizar esta acción';
        break;
      
      case 404:
        errorMessage = 'Recurso no encontrado';
        break;
      
      case 409:
        errorMessage = error.error?.message || 'Conflicto en los datos';
        break;
      
      case 422:
        errorMessage = error.error?.message || 'Error de validación';
        break;
      
      case 429:
        errorMessage = 'Demasiadas solicitudes. Intenta nuevamente en unos minutos.';
        break;
      
      case 500:
        errorMessage = 'Error interno del servidor. Intenta nuevamente más tarde.';
        break;
      
      case 502:
      case 503:
      case 504:
        errorMessage = 'Servicio no disponible temporalmente. Intenta más tarde.';
        break;
      
      default:
        errorMessage = `Error ${error.status}: ${error.error?.message || error.message}`;
        break;
    }

    // Log error for debugging
    console.error('HTTP Error:', {
      status: error.status,
      message: errorMessage,
      url: error.url,
      error: error.error
    });

    // Show toast notification
    if (shouldShowToast && error.status !== 401) { // Don't show toast for redirected auth errors
      this.showErrorToast(errorMessage);
    }

    return throwError(() => new Error(errorMessage));
  }

  private async showErrorToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 5000,
      position: 'top',
      color: 'danger',
      buttons: [
        {
          text: 'Cerrar',
          role: 'cancel'
        }
      ]
    });
    
    await toast.present();
  }
}