-- Validated catalogue snapshots are supplied only by the server, never by a public database client.
-- Both the reservation and its herb are committed in the same transaction.
create or replace function public.sauna_reserve_with_herb(
  p_site text, p_room uuid, p_starts_at timestamptz, p_turn_type uuid, p_kind text,
  p_seats integer, p_name text, p_whatsapp text, p_code text, p_pack_token text,
  p_terms_accepted boolean, p_herb jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_result jsonb;
begin
  v_result := public.sauna_reserve(p_site, p_room, p_starts_at, p_turn_type, p_kind,
    p_seats, p_name, p_whatsapp, p_code, p_pack_token, p_terms_accepted);
  if (v_result->>'ok')::boolean then
    update public.sauna_bookings
      set policy_snapshot = policy_snapshot || jsonb_build_object('herb', p_herb)
      where site_id = p_site and id = (v_result->'booking'->>'id')::uuid;
  end if;
  return v_result;
end;
$$;
revoke execute on function public.sauna_reserve_with_herb(text, uuid, timestamptz, uuid, text, integer, text, text, text, text, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.sauna_reserve_with_herb(text, uuid, timestamptz, uuid, text, integer, text, text, text, text, boolean, jsonb) to service_role;

create or replace function public.sauna_reserve_plan_with_herbs(
  p_site text, p_plan uuid, p_turns jsonb, p_name text, p_whatsapp text,
  p_terms_accepted boolean, p_code text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_result jsonb;
begin
  v_result := public.sauna_reserve_plan(p_site, p_plan, p_turns, p_name, p_whatsapp, p_terms_accepted, p_code);
  if (v_result->>'ok')::boolean then
    update public.sauna_bookings b
      set policy_snapshot = b.policy_snapshot || jsonb_build_object('herb', t.value->'herb')
      from public.sauna_plan_purchases purchase, public.sauna_slots slot, jsonb_array_elements(p_turns) t
      where purchase.site_id = p_site and purchase.token = v_result->>'token'
        and b.site_id = p_site and b.plan_purchase_id = purchase.id
        and slot.site_id = p_site and slot.id = b.slot_id
        and slot.room_id = (t.value->>'room_id')::uuid
        and slot.starts_at = (t.value->>'starts_at')::timestamptz;
  end if;
  return v_result;
end;
$$;
revoke execute on function public.sauna_reserve_plan_with_herbs(text, uuid, jsonb, text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.sauna_reserve_plan_with_herbs(text, uuid, jsonb, text, text, boolean, text) to service_role;
