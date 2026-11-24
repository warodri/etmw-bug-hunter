import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from './api.config';

export type QueryParams = Record<string, string | number | boolean>;
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** The only class that knows the API base URL. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private readonly http: HttpClient) {}

  /** The absolute URL of a path, for downloads opened by the browser rather than HttpClient. */
  resolve(path: string): string {
    return `${API_BASE_URL}${path}`;
  }

  get<T>(path: string, params?: QueryParams): Observable<T> {
    return this.request<T>('GET', path, undefined, params);
  }

  post<T>(path: string, body?: unknown): Observable<T> {
    return this.request<T>('POST', path, body);
  }

  put<T>(path: string, body?: unknown): Observable<T> {
    return this.request<T>('PUT', path, body);
  }

  patch<T>(path: string, body?: unknown): Observable<T> {
    return this.request<T>('PATCH', path, body);
  }

  delete<T>(path: string): Observable<T> {
    return this.request<T>('DELETE', path);
  }

  private request<T>(
    method: HttpMethod,
    path: string,
    body?: unknown,
    params?: QueryParams
  ): Observable<T> {
    return this.http.request<T>(method, `${API_BASE_URL}${path}`, {
      body,
      params: this.toHttpParams(params)
    });
  }

  private toHttpParams(params?: QueryParams): HttpParams | undefined {
    if (!params) return undefined;

    let httpParams = new HttpParams();

    for (const [key, value] of Object.entries(params)) {
      httpParams = httpParams.set(key, String(value));
    }

    return httpParams;
  }
}
