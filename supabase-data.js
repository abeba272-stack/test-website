import { supabase, isSupabaseConfigured } from './supabase.js';

function assertConfigured() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase ist nicht konfiguriert.');
  }
}

function mapBookingRow(row) {
  return {
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    serviceId: row.service_id,
    serviceName: row.service_name,
    durationMin: row.duration_min,
    priceFrom: Number(row.price_from || 0),
    deposit: Number(row.deposit || 0),
    stylistId: row.stylist_id,
    stylistName: row.stylist_name,
    dateISO: row.date_iso,
    time: row.time,
    customer: row.customer || {},
    depositPaid: Boolean(row.deposit_paid)
  };
}

function mapWaitlistRow(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    serviceId: row.service_id,
    serviceName: row.service_name,
    email: row.email,
    phone: row.phone,
    note: row.note || ''
  };
}

export async function getCurrentUser() {
  assertConfigured();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user || null;
}

export async function getMyBookings() {
  assertConfigured();
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapBookingRow);
}

export async function createMyBooking(model, userId) {
  assertConfigured();
  const payload = {
    user_id: userId,
    status: model.status || 'requested',
    service_id: model.serviceId,
    service_name: model.serviceName,
    duration_min: model.durationMin,
    price_from: model.priceFrom || 0,
    deposit: model.deposit || 0,
    stylist_id: model.stylistId || 'auto',
    stylist_name: model.stylistName || 'Egal (automatisch)',
    date_iso: model.dateISO,
    time: model.time,
    customer: model.customer || {},
    deposit_paid: Boolean(model.depositPaid)
  };
  const { data, error } = await supabase
    .from('bookings')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return mapBookingRow(data);
}

export async function updateMyBookingStatus(id, status) {
  assertConfigured();
  const { error } = await supabase
    .from('bookings')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
}

export async function clearMyBookings(userId) {
  assertConfigured();
  if (!userId) throw new Error('Kein User gefunden.');
  const { error } = await supabase
    .from('bookings')
    .delete()
    .eq('user_id', userId);
  if (error) throw error;
}

export async function getMyWaitlist() {
  assertConfigured();
  const { data, error } = await supabase
    .from('waitlist')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapWaitlistRow);
}

export async function createMyWaitlistEntry(model, userId) {
  assertConfigured();
  const payload = {
    user_id: userId,
    service_id: model.serviceId,
    service_name: model.serviceName,
    email: model.email,
    phone: model.phone,
    note: model.note || ''
  };
  const { data, error } = await supabase
    .from('waitlist')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return mapWaitlistRow(data);
}

export async function removeMyWaitlistEntry(id) {
  assertConfigured();
  const { error } = await supabase
    .from('waitlist')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function clearMyWaitlist(userId) {
  assertConfigured();
  if (!userId) throw new Error('Kein User gefunden.');
  const { error } = await supabase
    .from('waitlist')
    .delete()
    .eq('user_id', userId);
  if (error) throw error;
}
