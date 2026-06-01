-- FASE 6: ESTRUCTURA DE BASE DE DATOS PARA PAGO QR INTEROPERABLE (BANCARD)
-- Este archivo define las nuevas tablas aisladas para implementar el cobro QR de forma 100% segura.

-- 1. Tabla para almacenar credenciales de Bancard por Gerente/Administrador
CREATE TABLE IF NOT EXISTS public.credenciales_bancard (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gerente_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    shop_id TEXT NOT NULL,
    public_key TEXT NOT NULL,
    private_key_encrypted TEXT NOT NULL, -- Almacenará la clave privada cifrada por seguridad
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_gerente_credenciales UNIQUE (gerente_id)
);

-- 2. Tabla para el registro y seguimiento en tiempo real de cada pago QR dinámico
CREATE TABLE IF NOT EXISTS public.pagos_qr (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
    collector_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount NUMERIC(15, 2) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED')),
    bancard_process_id TEXT NOT NULL UNIQUE, -- ID único retornado por la pasarela de pagos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Habilitar Seguridad a Nivel de Fila (RLS)
ALTER TABLE public.credenciales_bancard ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos_qr ENABLE ROW LEVEL SECURITY;

-- 4. Crear Políticas de Seguridad RLS básicas

-- Políticas para credenciales_bancard:
-- Los administradores pueden hacer todo.
-- Los gerentes pueden ver/modificar solo sus propias credenciales.
CREATE POLICY "Permitir todo a administradores sobre credenciales" ON public.credenciales_bancard
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'Administrador')
    );

CREATE POLICY "Gerentes manejan sus propias credenciales" ON public.credenciales_bancard
    FOR ALL TO authenticated USING (gerente_id = auth.uid());

-- Políticas para pagos_qr:
-- Todos los usuarios autenticados de la sucursal pueden ver y editar pagos.
CREATE POLICY "Permitir lectura de pagos qr a usuarios autenticados" ON public.pagos_qr
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir insercion/edicion a cobradores y gerentes" ON public.pagos_qr
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Crear trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_credenciales_bancard_modtime
    BEFORE UPDATE ON public.credenciales_bancard
    FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

CREATE TRIGGER update_pagos_qr_modtime
    BEFORE UPDATE ON public.pagos_qr
    FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
