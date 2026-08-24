-- Creates a new company and owner membership when a public user signs up
-- through FieldFlow's business-registration form. A user cannot choose an
-- existing account id or grant themselves an Operations role.
create or replace function public.handle_new_business_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  company_name text := trim(new.raw_user_meta_data ->> 'company_name');
  account_id text := 'acct_' || replace(gen_random_uuid()::text, '-', '');
begin
  if new.raw_user_meta_data ->> 'signup_type' <> 'fieldflow_business' then
    return new;
  end if;
  if company_name is null or char_length(company_name) < 2 or char_length(company_name) > 120 then
    raise exception 'A business name between 2 and 120 characters is required';
  end if;

  insert into public.accounts (id, name, plan)
  values (account_id, company_name, 'Starter');

  insert into public.account_memberships (account_id, user_id, role)
  values (account_id, new.id, 'owner');

  return new;
end;
$$;

revoke all on function public.handle_new_business_user() from public;

drop trigger if exists on_fieldflow_business_signup on auth.users;
create trigger on_fieldflow_business_signup
  after insert on auth.users
  for each row execute function public.handle_new_business_user();
