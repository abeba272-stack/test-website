import { supabase, isSupabaseConfigured } from './supabase.js';

function assertConfigured() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase ist nicht konfiguriert.');
  }
}

function isMissingRpc(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('could not find the function') || message.includes('does not exist');
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

function mapRole(value) {
  if (value === 'staff' || value === 'admin') return value;
  return 'customer';
}

export async function getCurrentUser() {
  assertConfigured();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user || null;
}

export async function getCurrentUserRole() {
  assertConfigured();
  const { data, error } = await supabase.rpc('current_user_role');
  if (error) {
    if (isMissingRpc(error)) return 'customer';
    throw error;
  }
  return mapRole(data);
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
  if (!userId) throw new Error('Kein User gefunden.');
  const payload = {
    p_service_id: model.serviceId,
    p_service_name: model.serviceName,
    p_duration_min: model.durationMin,
    p_price_from: model.priceFrom || 0,
    p_deposit: model.deposit || 0,
    p_stylist_id: model.stylistId || 'auto',
    p_stylist_name: model.stylistName || 'Egal (automatisch)',
    p_date_iso: model.dateISO,
    p_time: model.time,
    p_customer: model.customer || {},
    p_deposit_paid: Boolean(model.depositPaid)
  };
  const { data, error } = await supabase.rpc('create_booking_secure', payload);
  if (!error) return mapBookingRow(data);
  if (!isMissingRpc(error)) throw error;

  const fallbackPayload = {
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
  const fallback = await supabase
    .from('bookings')
    .insert(fallbackPayload)
    .select('*')
    .single();
  if (fallback.error) throw fallback.error;
  return mapBookingRow(fallback.data);
}

export async function updateBookingStatus(id, status) {
  assertConfigured();
  const { data, error } = await supabase.rpc('set_booking_status', {
    p_booking_id: id,
    p_status: status
  });
  if (!error) return mapBookingRow(data);
  if (!isMissingRpc(error)) throw error;

  const fallback = await supabase
    .from('bookings')
    .update({ status })
    .eq('id', id)
    .select('*')
    .single();
  if (fallback.error) throw fallback.error;
  return mapBookingRow(fallback.data);
}

export async function cancelMyBooking(id) {
  assertConfigured();
  const { data, error } = await supabase.rpc('cancel_my_booking', {
    p_booking_id: id
  });
  if (!error) return mapBookingRow(data);
  if (!isMissingRpc(error)) throw error;

  const fallback = await supabase
    .from('bookings')
    .update({ status: 'canceled' })
    .eq('id', id)
    .select('*')
    .single();
  if (fallback.error) throw fallback.error;
  return mapBookingRow(fallback.data);
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
  if (!userId) throw new Error('Kein User gefunden.');
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

export async function checkSlotAvailability({ dateISO, time, durationMin, stylistId = 'auto', excludeBookingId = null }) {
  assertConfigured();
  const { data, error } = await supabase.rpc('slot_is_available', {
    p_date_iso: dateISO,
    p_time: time,
    p_duration_min: durationMin,
    p_stylist_id: stylistId,
    p_exclude_booking_id: excludeBookingId
  });
  if (error) throw error;
  return Boolean(data);
}
