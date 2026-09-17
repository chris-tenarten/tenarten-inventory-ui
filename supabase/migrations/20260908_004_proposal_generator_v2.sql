-- Proposal Generator V2: versioned estimating defaults, authoritative Estimate
-- calculations, structured customer context, and immutable issued snapshots.
-- Existing issued Proposals are intentionally not rewritten or backfilled.
begin;

create table public.proposal_estimating_default_versions (
  id uuid primary key default gen_random_uuid(),
  version integer not null unique check (version > 0),
  calculation_version text not null check (btrim(calculation_version) <> ''),
  assumptions jsonb not null check (jsonb_typeof(assumptions) = 'object'),
  prior_version_id uuid unique references public.proposal_estimating_default_versions(id) on delete restrict,
  change_note text check (change_note is null or length(change_note) <= 1000),
  created_by_user_id uuid references public.app_users(user_id) on delete restrict,
  created_by_name text not null check (btrim(created_by_name) <> ''),
  created_at timestamptz not null default clock_timestamp()
);

create table public.proposal_estimates (
  proposal_id uuid primary key references public.proposals(id) on delete cascade,
  defaults_version_id uuid not null references public.proposal_estimating_default_versions(id) on delete restrict,
  calculation_version text not null check (btrim(calculation_version) <> ''),
  default_assumptions jsonb not null check (jsonb_typeof(default_assumptions) = 'object'),
  assumption_overrides jsonb not null default '{}'::jsonb check (jsonb_typeof(assumption_overrides) = 'object'),
  effective_assumptions jsonb not null check (jsonb_typeof(effective_assumptions) = 'object'),
  inputs jsonb not null check (jsonb_typeof(inputs) = 'object'),
  outputs jsonb not null check (jsonb_typeof(outputs) = 'object'),
  created_by_user_id uuid not null references public.app_users(user_id) on delete restrict,
  updated_by_user_id uuid not null references public.app_users(user_id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

alter table public.proposals
  add column customer_street text not null default '' check (length(customer_street) <= 1000),
  add column customer_city text not null default '' check (length(customer_city) <= 200),
  add column customer_state text not null default '' check (length(customer_state) <= 100),
  add column customer_postal_code text not null default '' check (length(customer_postal_code) <= 40),
  add column customer_contact_name text not null default '' check (length(customer_contact_name) <= 300),
  add column customer_office_phone text not null default '' check (length(customer_office_phone) <= 100),
  add column customer_mobile_phone text not null default '' check (length(customer_mobile_phone) <= 100),
  add column customer_email text not null default '' check (length(customer_email) <= 320);

alter table public.proposal_lines
  add column geometry_profile text check (geometry_profile is null or geometry_profile in ('flat','tread_riser','custom','none')),
  add column dimension_applicability jsonb not null default '{}'::jsonb check (jsonb_typeof(dimension_applicability) = 'object'),
  add column length_inches numeric check (length_inches is null or length_inches >= 0),
  add column width_inches numeric check (width_inches is null or width_inches >= 0),
  add column riser_height_inches numeric check (riser_height_inches is null or riser_height_inches >= 0),
  add column thickness_inches numeric check (thickness_inches is null or thickness_inches >= 0),
  add column cubic_feet numeric check (cubic_feet is null or cubic_feet >= 0),
  add column linear_feet numeric check (linear_feet is null or linear_feet >= 0),
  add column estimated_weight_pounds numeric check (estimated_weight_pounds is null or estimated_weight_pounds >= 0);

-- Historical documents retain their recorded renderer version. Only documents
-- created after Proposal V2 is installed use the V2 renderer contract.
alter table public.proposal_pdf_documents
  alter column document_version set default 'proposal-pdf-v2';

create index proposal_estimates_defaults_version_idx
  on public.proposal_estimates(defaults_version_id);

create or replace function public.proposal_validate_estimating_assumptions(p_assumptions jsonb)
returns void
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  key text;
  unknown_key text;
  required_positive constant text[] := array[
    'materialDensityLbPerCubicFoot','batchCapacityCubicFeet','poundsPerBatch','chipBagWeightPounds',
    'piecesPerSlab','laborRatePerHour','crewSize','hoursPerDay','shopCostPerDay',
    'resinGallonsPerBatch','resinCostPerGallon','hardenerResinRatio','hardenerCostPerGallon',
    'fillerBagsPerBatch','fillerCostPerBag','groutCoverageSfPerGallon','groutCostPerGallon',
    'sealerCoverageSfPerGallon','sealerCostPerGallon','blendHoursPerTwentyBags',
    'setupHoursPerSlab','pourHoursPerBatch','removeStageHoursPerSlab','gaugeSfPerHour',
    'grindSfPerHour','groutSfPerHour','removeGroutSfPerHour','sawCutLfPerHour',
    'edgeFinishLfPerHour','handlingItemsPerHour','cleanSealSfPerHour'
  ];
  required_nonnegative constant text[] := array[
    'materialsMarkupPercent','freightMarkupPercent','laborMarkupPercent','shopMarkupPercent',
    'repFeePercent','difficultyFactorPercent','chipFreightPerBag','liquidFreightPerGallon',
    'fillerFreightPerBag','sealerFreightPerGallon'
  ];
begin
  if coalesce(jsonb_typeof(p_assumptions),'') <> 'object' then
    raise exception 'Estimating assumptions must be a JSON object.' using errcode = '22023';
  end if;

  foreach key in array required_positive loop
    if coalesce(jsonb_typeof(p_assumptions -> key),'') <> 'number'
       or (p_assumptions ->> key)::numeric <= 0 then
      raise exception 'Estimating assumption % must be greater than zero.', key using errcode = '22023';
    end if;
  end loop;

  foreach key in array required_nonnegative loop
    if coalesce(jsonb_typeof(p_assumptions -> key),'') <> 'number'
       or (p_assumptions ->> key)::numeric < 0 then
      raise exception 'Estimating assumption % cannot be negative.', key using errcode = '22023';
    end if;
  end loop;

  if coalesce(p_assumptions ->> 'batchRounding','') not in ('fractional','whole_up')
     or coalesce(p_assumptions ->> 'shopDayRounding','') not in ('fractional','whole_up') then
    raise exception 'Estimating rounding mode is invalid.' using errcode = '22023';
  end if;

  select candidate into unknown_key
  from jsonb_object_keys(p_assumptions) as keys(candidate)
  where not (
    candidate = any(
      required_positive || required_nonnegative || array['batchRounding','shopDayRounding']::text[]
    )
  )
  limit 1;
  if unknown_key is not null then
    raise exception 'Unknown estimating assumption: %.',unknown_key using errcode='22023';
  end if;

  if (p_assumptions ->> 'hoursPerDay')::numeric > 24 then
    raise exception 'Hours per day cannot exceed 24.' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.proposal_validate_estimate_inputs(p_inputs jsonb)
returns void
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  key text;
  blend jsonb;
  blend_total numeric := 0;
  numeric_keys constant text[] := array[
    'customerQuantity','lengthInches','widthInches','riserHeightInches','thicknessInches',
    'depthInches','roughLengthInches','roughWidthInches','roughThicknessInches',
    'productionQuantityOverride'
  ];
begin
  if coalesce(jsonb_typeof(p_inputs),'') <> 'object' then
    raise exception 'Estimate inputs must be a JSON object.' using errcode = '22023';
  end if;
  if coalesce(p_inputs ->> 'geometryProfile','') not in ('flat','tread_riser','custom') then
    raise exception 'Estimate geometry profile is invalid.' using errcode = '22023';
  end if;
  foreach key in array numeric_keys loop
    if p_inputs ? key and jsonb_typeof(p_inputs -> key) not in ('number','null') then
      raise exception 'Estimate input % must be numeric or null.', key using errcode = '22023';
    end if;
    if jsonb_typeof(p_inputs -> key) = 'number' and (p_inputs ->> key)::numeric < 0 then
      raise exception 'Estimate input % cannot be negative.', key using errcode = '22023';
    end if;
  end loop;
  if coalesce(jsonb_typeof(p_inputs -> 'chipBlend'),'') <> 'array'
     or jsonb_array_length(p_inputs -> 'chipBlend') > 50 then
    raise exception 'Estimate chip blend must be an array of at most 50 rows.' using errcode = '22023';
  end if;
  for blend in select value from jsonb_array_elements(p_inputs -> 'chipBlend') loop
    if coalesce(jsonb_typeof(blend),'') <> 'object'
       or coalesce(jsonb_typeof(blend -> 'percentage'),'') <> 'number'
       or coalesce(jsonb_typeof(blend -> 'unitCostPerBag'),'') <> 'number' then
      raise exception 'Each chip blend row requires numeric percentage and unit cost.' using errcode = '22023';
    end if;
    if (blend ->> 'percentage')::numeric < 0 or (blend ->> 'percentage')::numeric > 100
       or (blend ->> 'unitCostPerBag')::numeric < 0 then
      raise exception 'Chip blend percentage or cost is invalid.' using errcode = '22023';
    end if;
    blend_total := blend_total + (blend ->> 'percentage')::numeric;
  end loop;
  if blend_total > 100 then
    raise exception 'Chip blend percentages cannot exceed 100%%.' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.proposal_calculate_estimate_v2(
  p_inputs jsonb,
  p_assumptions jsonb
)
returns jsonb
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  profile text;
  customer_quantity numeric;
  length_value numeric;
  width_value numeric;
  riser_height numeric;
  depth_value numeric;
  developed_width numeric;
  thickness_value numeric;
  production_override numeric;
  calculated_quantity numeric;
  production_quantity numeric;
  quantity_source text;
  pieces_per_slab numeric;
  slab_count numeric;
  piece_square_feet numeric;
  piece_cubic_feet numeric;
  customer_square_feet numeric;
  production_square_feet numeric;
  customer_cubic_feet numeric;
  production_cubic_feet numeric;
  customer_linear_feet numeric;
  production_linear_feet numeric;
  rough_length numeric;
  rough_width numeric;
  rough_thickness numeric;
  rough_square_feet numeric;
  rough_cubic_feet numeric;
  batch_count numeric;
  waste_percent numeric;
  chip_pounds numeric;
  chip_bags numeric;
  blend jsonb;
  row_quantity numeric;
  row_cost numeric;
  resin_gallons numeric;
  hardener_gallons numeric;
  filler_bags numeric;
  grout_gallons numeric;
  sealer_gallons numeric;
  material_rows jsonb := '[]'::jsonb;
  material_total numeric := 0;
  freight_rows jsonb := '[]'::jsonb;
  freight_total numeric := 0;
  labor_rows jsonb := '[]'::jsonb;
  labor_rate numeric;
  saw_cut_linear_feet numeric;
  edge_finish_linear_feet numeric;
  hours_value numeric;
  base_hours numeric := 0;
  difficulty_hours numeric;
  total_hours numeric;
  capacity_hours_per_day numeric;
  calculated_shop_days numeric;
  effective_shop_days numeric;
  shop_total numeric;
  base_cost numeric;
  materials_markup numeric;
  freight_markup numeric;
  labor_markup numeric;
  shop_markup numeric;
  total_markup numeric;
  rep_fee numeric;
  internal_total numeric;
begin
  perform public.proposal_validate_estimating_assumptions(p_assumptions);
  perform public.proposal_validate_estimate_inputs(p_inputs);

  profile := p_inputs ->> 'geometryProfile';
  customer_quantity := (p_inputs ->> 'customerQuantity')::numeric;
  length_value := (p_inputs ->> 'lengthInches')::numeric;
  width_value := (p_inputs ->> 'widthInches')::numeric;
  riser_height := (p_inputs ->> 'riserHeightInches')::numeric;
  depth_value := (p_inputs ->> 'depthInches')::numeric;
  thickness_value := (p_inputs ->> 'thicknessInches')::numeric;
  production_override := (p_inputs ->> 'productionQuantityOverride')::numeric;

  if profile = 'flat' then
    developed_width := width_value;
  elsif profile = 'tread_riser' then
    developed_width := case when depth_value is not null and riser_height is not null then depth_value + riser_height end;
  else
    developed_width := coalesce(width_value,case when depth_value is not null and riser_height is not null then depth_value + riser_height end);
  end if;

  pieces_per_slab := (p_assumptions ->> 'piecesPerSlab')::numeric;
  calculated_quantity := case when customer_quantity is not null then ceil(customer_quantity / pieces_per_slab) * pieces_per_slab end;
  production_quantity := coalesce(production_override,calculated_quantity);
  quantity_source := case when production_override is not null then 'override' when calculated_quantity is not null then 'calculated' else 'unavailable' end;
  slab_count := case when production_quantity is not null then ceil(production_quantity / pieces_per_slab) end;

  piece_square_feet := case when length_value is not null and developed_width is not null then length_value * developed_width / 144 end;
  piece_cubic_feet := case when length_value is not null and developed_width is not null and thickness_value is not null then length_value * developed_width * thickness_value / 1728 end;
  customer_square_feet := case when piece_square_feet is not null and customer_quantity is not null then piece_square_feet * customer_quantity end;
  production_square_feet := case when piece_square_feet is not null and production_quantity is not null then piece_square_feet * production_quantity end;
  customer_cubic_feet := case when piece_cubic_feet is not null and customer_quantity is not null then piece_cubic_feet * customer_quantity end;
  production_cubic_feet := case when piece_cubic_feet is not null and production_quantity is not null then piece_cubic_feet * production_quantity end;
  customer_linear_feet := case when length_value is not null and customer_quantity is not null then ceil(length_value * customer_quantity / 12) end;
  production_linear_feet := case when length_value is not null and production_quantity is not null then length_value * production_quantity / 12 end;

  rough_length := (p_inputs ->> 'roughLengthInches')::numeric;
  rough_width := (p_inputs ->> 'roughWidthInches')::numeric;
  rough_thickness := (p_inputs ->> 'roughThicknessInches')::numeric;
  rough_square_feet := case when rough_length is not null and rough_width is not null and slab_count is not null then rough_length * rough_width * slab_count / 144 end;
  rough_cubic_feet := case when rough_length is not null and rough_width is not null and rough_thickness is not null and slab_count is not null then rough_length * rough_width * rough_thickness * slab_count / 1728 end;
  batch_count := case when rough_cubic_feet is not null then rough_cubic_feet / (p_assumptions ->> 'batchCapacityCubicFeet')::numeric end;
  if batch_count is not null and p_assumptions ->> 'batchRounding' = 'whole_up' then batch_count := ceil(batch_count); end if;
  waste_percent := case when rough_cubic_feet is not null and production_cubic_feet > 0 then (rough_cubic_feet / production_cubic_feet - 1) * 100 end;
  chip_pounds := case when batch_count is not null then batch_count * (p_assumptions ->> 'poundsPerBatch')::numeric end;
  chip_bags := case when chip_pounds is not null then chip_pounds / (p_assumptions ->> 'chipBagWeightPounds')::numeric end;

  if chip_bags is not null then
    for blend in select value from jsonb_array_elements(p_inputs -> 'chipBlend') loop
      row_quantity := chip_bags * greatest((blend ->> 'percentage')::numeric,0) / 100;
      row_cost := row_quantity * greatest((blend ->> 'unitCostPerBag')::numeric,0);
      material_total := material_total + row_cost;
      material_rows := material_rows || jsonb_build_array(jsonb_build_object(
        'key','chip-' || coalesce(nullif(blend ->> 'id',''),'material'),
        'label',coalesce(nullif(blend ->> 'color',''),'Chip blend material'),
        'quantity',row_quantity,
        'unit',(p_assumptions ->> 'chipBagWeightPounds') || ' lb bag',
        'unitCost',greatest((blend ->> 'unitCostPerBag')::numeric,0),
        'cost',row_cost
      ));
    end loop;
  end if;

  resin_gallons := coalesce(batch_count,0) * (p_assumptions ->> 'resinGallonsPerBatch')::numeric;
  hardener_gallons := resin_gallons / (p_assumptions ->> 'hardenerResinRatio')::numeric;
  filler_bags := coalesce(batch_count,0) * (p_assumptions ->> 'fillerBagsPerBatch')::numeric;
  grout_gallons := coalesce(rough_square_feet,0) / (p_assumptions ->> 'groutCoverageSfPerGallon')::numeric;
  sealer_gallons := coalesce(rough_square_feet,0) / (p_assumptions ->> 'sealerCoverageSfPerGallon')::numeric;

  row_cost := resin_gallons * (p_assumptions ->> 'resinCostPerGallon')::numeric;
  material_total := material_total + row_cost;
  material_rows := material_rows || jsonb_build_array(jsonb_build_object('key','resin','label',coalesce(nullif(p_inputs ->> 'resinColor',''),'Epoxy resin'),'quantity',resin_gallons,'unit','gal','unitCost',(p_assumptions ->> 'resinCostPerGallon')::numeric,'cost',row_cost));
  row_cost := hardener_gallons * (p_assumptions ->> 'hardenerCostPerGallon')::numeric;
  material_total := material_total + row_cost;
  material_rows := material_rows || jsonb_build_array(jsonb_build_object('key','hardener','label','Epoxy hardener','quantity',hardener_gallons,'unit','gal','unitCost',(p_assumptions ->> 'hardenerCostPerGallon')::numeric,'cost',row_cost));
  row_cost := filler_bags * (p_assumptions ->> 'fillerCostPerBag')::numeric;
  material_total := material_total + row_cost;
  material_rows := material_rows || jsonb_build_array(jsonb_build_object('key','filler','label',coalesce(nullif(p_inputs ->> 'filler',''),'Marble filler'),'quantity',filler_bags,'unit','bag','unitCost',(p_assumptions ->> 'fillerCostPerBag')::numeric,'cost',row_cost));
  row_cost := grout_gallons * (p_assumptions ->> 'groutCostPerGallon')::numeric;
  material_total := material_total + row_cost;
  material_rows := material_rows || jsonb_build_array(jsonb_build_object('key','grout','label','Pinhole grout','quantity',grout_gallons,'unit','gal','unitCost',(p_assumptions ->> 'groutCostPerGallon')::numeric,'cost',row_cost));
  row_cost := sealer_gallons * (p_assumptions ->> 'sealerCostPerGallon')::numeric;
  material_total := material_total + row_cost;
  material_rows := material_rows || jsonb_build_array(jsonb_build_object('key','sealer','label',coalesce(nullif(p_inputs ->> 'sealer',''),'Top coat sealer'),'quantity',sealer_gallons,'unit','gal','unitCost',(p_assumptions ->> 'sealerCostPerGallon')::numeric,'cost',row_cost));

  row_quantity := coalesce(chip_bags,0); row_cost := row_quantity * (p_assumptions ->> 'chipFreightPerBag')::numeric;
  freight_total := freight_total + row_cost;
  freight_rows := freight_rows || jsonb_build_array(jsonb_build_object('key','chips','label','Chip freight','quantity',row_quantity,'unit','bag','unitCost',(p_assumptions ->> 'chipFreightPerBag')::numeric,'cost',row_cost));
  row_quantity := resin_gallons + hardener_gallons + grout_gallons; row_cost := row_quantity * (p_assumptions ->> 'liquidFreightPerGallon')::numeric;
  freight_total := freight_total + row_cost;
  freight_rows := freight_rows || jsonb_build_array(jsonb_build_object('key','liquids','label','Resin / hardener / grout freight','quantity',row_quantity,'unit','gal','unitCost',(p_assumptions ->> 'liquidFreightPerGallon')::numeric,'cost',row_cost));
  row_quantity := filler_bags; row_cost := row_quantity * (p_assumptions ->> 'fillerFreightPerBag')::numeric;
  freight_total := freight_total + row_cost;
  freight_rows := freight_rows || jsonb_build_array(jsonb_build_object('key','filler','label','Filler freight','quantity',row_quantity,'unit','bag','unitCost',(p_assumptions ->> 'fillerFreightPerBag')::numeric,'cost',row_cost));
  row_quantity := sealer_gallons; row_cost := row_quantity * (p_assumptions ->> 'sealerFreightPerGallon')::numeric;
  freight_total := freight_total + row_cost;
  freight_rows := freight_rows || jsonb_build_array(jsonb_build_object('key','sealer','label','Sealer freight','quantity',row_quantity,'unit','gal','unitCost',(p_assumptions ->> 'sealerFreightPerGallon')::numeric,'cost',row_cost));

  labor_rate := (p_assumptions ->> 'laborRatePerHour')::numeric;
  saw_cut_linear_feet := case when rough_length is not null and rough_width is not null and slab_count is not null then ((rough_length * 3 + rough_width * 2) / 12) * slab_count else 0 end;
  edge_finish_linear_feet := coalesce(production_linear_feet,0);

  row_quantity := coalesce(chip_bags,0); hours_value := row_quantity / 20 * (p_assumptions ->> 'blendHoursPerTwentyBags')::numeric;
  base_hours := base_hours + hours_value; labor_rows := labor_rows || jsonb_build_array(jsonb_build_object('key','blend','label','Blend chips','quantity',row_quantity,'unit','bags','unitCost',labor_rate,'cost',hours_value*labor_rate,'hours',hours_value));
  row_quantity := coalesce(slab_count,0); hours_value := row_quantity * (p_assumptions ->> 'setupHoursPerSlab')::numeric;
  base_hours := base_hours + hours_value; labor_rows := labor_rows || jsonb_build_array(jsonb_build_object('key','setup','label','Set up and tear down forms','quantity',row_quantity,'unit','forms','unitCost',labor_rate,'cost',hours_value*labor_rate,'hours',hours_value));
  row_quantity := coalesce(batch_count,0); hours_value := row_quantity * (p_assumptions ->> 'pourHoursPerBatch')::numeric;
  base_hours := base_hours + hours_value; labor_rows := labor_rows || jsonb_build_array(jsonb_build_object('key','pour','label','Pour','quantity',row_quantity,'unit','batches','unitCost',labor_rate,'cost',hours_value*labor_rate,'hours',hours_value));
  row_quantity := coalesce(slab_count,0); hours_value := row_quantity * (p_assumptions ->> 'removeStageHoursPerSlab')::numeric;
  base_hours := base_hours + hours_value; labor_rows := labor_rows || jsonb_build_array(jsonb_build_object('key','remove','label','Remove and stage','quantity',row_quantity,'unit','forms','unitCost',labor_rate,'cost',hours_value*labor_rate,'hours',hours_value));
  row_quantity := coalesce(rough_square_feet,0); hours_value := row_quantity / (p_assumptions ->> 'gaugeSfPerHour')::numeric;
  base_hours := base_hours + hours_value; labor_rows := labor_rows || jsonb_build_array(jsonb_build_object('key','gauge','label','Gauge','quantity',row_quantity,'unit','sf','unitCost',labor_rate,'cost',hours_value*labor_rate,'hours',hours_value));
  hours_value := row_quantity / (p_assumptions ->> 'grindSfPerHour')::numeric;
  base_hours := base_hours + hours_value; labor_rows := labor_rows || jsonb_build_array(jsonb_build_object('key','grind','label','Grind','quantity',row_quantity,'unit','sf','unitCost',labor_rate,'cost',hours_value*labor_rate,'hours',hours_value));
  hours_value := row_quantity / (p_assumptions ->> 'groutSfPerHour')::numeric;
  base_hours := base_hours + hours_value; labor_rows := labor_rows || jsonb_build_array(jsonb_build_object('key','grout','label','Grout','quantity',row_quantity,'unit','sf','unitCost',labor_rate,'cost',hours_value*labor_rate,'hours',hours_value));
  hours_value := row_quantity / (p_assumptions ->> 'removeGroutSfPerHour')::numeric;
  base_hours := base_hours + hours_value; labor_rows := labor_rows || jsonb_build_array(jsonb_build_object('key','remove-grout','label','Remove grout','quantity',row_quantity,'unit','sf','unitCost',labor_rate,'cost',hours_value*labor_rate,'hours',hours_value));
  row_quantity := saw_cut_linear_feet; hours_value := row_quantity / (p_assumptions ->> 'sawCutLfPerHour')::numeric;
  base_hours := base_hours + hours_value; labor_rows := labor_rows || jsonb_build_array(jsonb_build_object('key','saw','label','Cut to size','quantity',row_quantity,'unit','lf','unitCost',labor_rate,'cost',hours_value*labor_rate,'hours',hours_value));
  row_quantity := edge_finish_linear_feet; hours_value := row_quantity / (p_assumptions ->> 'edgeFinishLfPerHour')::numeric;
  base_hours := base_hours + hours_value; labor_rows := labor_rows || jsonb_build_array(jsonb_build_object('key','edge','label','Ease and polish edge','quantity',row_quantity,'unit','lf','unitCost',labor_rate,'cost',hours_value*labor_rate,'hours',hours_value));
  row_quantity := coalesce(production_quantity,0) * 2; hours_value := row_quantity / (p_assumptions ->> 'handlingItemsPerHour')::numeric;
  base_hours := base_hours + hours_value; labor_rows := labor_rows || jsonb_build_array(jsonb_build_object('key','handling','label','Handling','quantity',row_quantity,'unit','items','unitCost',labor_rate,'cost',hours_value*labor_rate,'hours',hours_value));
  row_quantity := coalesce(production_square_feet,0); hours_value := row_quantity / (p_assumptions ->> 'cleanSealSfPerHour')::numeric;
  base_hours := base_hours + hours_value; labor_rows := labor_rows || jsonb_build_array(jsonb_build_object('key','clean-seal','label','Clean and apply sealer','quantity',row_quantity,'unit','sf','unitCost',labor_rate,'cost',hours_value*labor_rate,'hours',hours_value));

  difficulty_hours := base_hours * (p_assumptions ->> 'difficultyFactorPercent')::numeric / 100;
  if difficulty_hours > 0 then
    labor_rows := labor_rows || jsonb_build_array(jsonb_build_object('key','difficulty','label','Difficulty factor','quantity',base_hours,'unit','base hours','unitCost',labor_rate,'cost',difficulty_hours*labor_rate,'hours',difficulty_hours));
  end if;
  total_hours := base_hours + difficulty_hours;
  capacity_hours_per_day := (p_assumptions ->> 'crewSize')::numeric * (p_assumptions ->> 'hoursPerDay')::numeric;
  calculated_shop_days := total_hours / capacity_hours_per_day;
  effective_shop_days := case when p_assumptions ->> 'shopDayRounding' = 'whole_up' then ceil(calculated_shop_days) else calculated_shop_days end;
  shop_total := effective_shop_days * (p_assumptions ->> 'shopCostPerDay')::numeric;
  base_cost := material_total + freight_total + total_hours * labor_rate + shop_total;
  materials_markup := material_total * (p_assumptions ->> 'materialsMarkupPercent')::numeric / 100;
  freight_markup := freight_total * (p_assumptions ->> 'freightMarkupPercent')::numeric / 100;
  labor_markup := total_hours * labor_rate * (p_assumptions ->> 'laborMarkupPercent')::numeric / 100;
  shop_markup := shop_total * (p_assumptions ->> 'shopMarkupPercent')::numeric / 100;
  total_markup := materials_markup + freight_markup + labor_markup + shop_markup;
  rep_fee := (base_cost + total_markup) * (p_assumptions ->> 'repFeePercent')::numeric / 100;
  internal_total := base_cost + total_markup + rep_fee;

  return jsonb_build_object(
    'calculationVersion','proposal-estimate-v2',
    'geometry',jsonb_build_object(
      'developedWidthInches',developed_width,
      'customerLinearFeet',customer_linear_feet,
      'productionLinearFeet',production_linear_feet,
      'customerSquareFeet',customer_square_feet,
      'productionSquareFeet',production_square_feet,
      'customerCubicFeet',customer_cubic_feet,
      'productionCubicFeet',production_cubic_feet,
      'customerEstimatedWeightLb',case when customer_cubic_feet is not null then customer_cubic_feet * (p_assumptions ->> 'materialDensityLbPerCubicFoot')::numeric end,
      'productionEstimatedWeightLb',case when production_cubic_feet is not null then production_cubic_feet * (p_assumptions ->> 'materialDensityLbPerCubicFoot')::numeric end
    ),
    'production',jsonb_build_object(
      'calculatedQuantity',calculated_quantity,'effectiveQuantity',production_quantity,'quantitySource',quantity_source,
      'slabCount',slab_count,'roughSquareFeet',rough_square_feet,'roughCubicFeet',rough_cubic_feet,
      'wastePercent',waste_percent,'batchCount',batch_count
    ),
    'materials',jsonb_build_object('chipPounds',chip_pounds,'chipBags',chip_bags,'rows',material_rows,'totalCost',material_total),
    'freight',jsonb_build_object('rows',freight_rows,'totalCost',freight_total),
    'labor',jsonb_build_object('rows',labor_rows,'baseHours',base_hours,'difficultyHours',difficulty_hours,'totalHours',total_hours,'totalCost',total_hours*labor_rate),
    'shop',jsonb_build_object('capacityHoursPerDay',capacity_hours_per_day,'calculatedDays',calculated_shop_days,'effectiveDays',effective_shop_days,'totalCost',shop_total),
    'pricing',jsonb_build_object(
      'baseCost',base_cost,
      'markupByCategory',jsonb_build_object('materials',materials_markup,'freight',freight_markup,'labor',labor_markup,'shop',shop_markup),
      'totalMarkup',total_markup,'repFee',rep_fee,'internalTotal',internal_total,
      'internalCalculatedUnitMetric',case when production_quantity > 0 then internal_total / production_quantity end,
      'perSquareFoot',case when production_square_feet > 0 then internal_total / production_square_feet end,
      'perLinearFoot',case when production_linear_feet > 0 then internal_total / production_linear_feet end,
      'perSlab',case when slab_count > 0 then internal_total / slab_count end,
      'perBatch',case when batch_count > 0 then internal_total / batch_count end
    )
  );
end;
$$;

select public.proposal_validate_estimating_assumptions($defaults$
{
  "materialDensityLbPerCubicFoot": 140,
  "batchCapacityCubicFeet": 1.768261,
  "poundsPerBatch": 200,
  "chipBagWeightPounds": 50,
  "piecesPerSlab": 2,
  "laborRatePerHour": 50,
  "crewSize": 6,
  "hoursPerDay": 11,
  "shopCostPerDay": 1250,
  "materialsMarkupPercent": 40,
  "freightMarkupPercent": 40,
  "laborMarkupPercent": 40,
  "shopMarkupPercent": 40,
  "repFeePercent": 5,
  "difficultyFactorPercent": 0,
  "batchRounding": "fractional",
  "shopDayRounding": "fractional",
  "resinGallonsPerBatch": 5,
  "resinCostPerGallon": 30,
  "hardenerResinRatio": 5,
  "hardenerCostPerGallon": 28.5,
  "fillerBagsPerBatch": 1,
  "fillerCostPerBag": 15,
  "groutCoverageSfPerGallon": 1200,
  "groutCostPerGallon": 30,
  "sealerCoverageSfPerGallon": 250,
  "sealerCostPerGallon": 32.7,
  "chipFreightPerBag": 7,
  "liquidFreightPerGallon": 7,
  "fillerFreightPerBag": 7,
  "sealerFreightPerGallon": 4,
  "blendHoursPerTwentyBags": 1,
  "setupHoursPerSlab": 0.5,
  "pourHoursPerBatch": 1.25,
  "removeStageHoursPerSlab": 0.25,
  "gaugeSfPerHour": 95.48611111111111,
  "grindSfPerHour": 47.74305555555556,
  "groutSfPerHour": 382,
  "removeGroutSfPerHour": 95.49,
  "sawCutLfPerHour": 114.58,
  "edgeFinishLfPerHour": 20,
  "handlingItemsPerHour": 44,
  "cleanSealSfPerHour": 176
}
$defaults$::jsonb);

insert into public.proposal_estimating_default_versions(
  version,calculation_version,assumptions,created_by_name,change_note
) values (
  1,
  'proposal-estimate-v2',
  $defaults$
  {
    "materialDensityLbPerCubicFoot": 140,
    "batchCapacityCubicFeet": 1.768261,
    "poundsPerBatch": 200,
    "chipBagWeightPounds": 50,
    "piecesPerSlab": 2,
    "laborRatePerHour": 50,
    "crewSize": 6,
    "hoursPerDay": 11,
    "shopCostPerDay": 1250,
    "materialsMarkupPercent": 40,
    "freightMarkupPercent": 40,
    "laborMarkupPercent": 40,
    "shopMarkupPercent": 40,
    "repFeePercent": 5,
    "difficultyFactorPercent": 0,
    "batchRounding": "fractional",
    "shopDayRounding": "fractional",
    "resinGallonsPerBatch": 5,
    "resinCostPerGallon": 30,
    "hardenerResinRatio": 5,
    "hardenerCostPerGallon": 28.5,
    "fillerBagsPerBatch": 1,
    "fillerCostPerBag": 15,
    "groutCoverageSfPerGallon": 1200,
    "groutCostPerGallon": 30,
    "sealerCoverageSfPerGallon": 250,
    "sealerCostPerGallon": 32.7,
    "chipFreightPerBag": 7,
    "liquidFreightPerGallon": 7,
    "fillerFreightPerBag": 7,
    "sealerFreightPerGallon": 4,
    "blendHoursPerTwentyBags": 1,
    "setupHoursPerSlab": 0.5,
    "pourHoursPerBatch": 1.25,
    "removeStageHoursPerSlab": 0.25,
    "gaugeSfPerHour": 95.48611111111111,
    "grindSfPerHour": 47.74305555555556,
    "groutSfPerHour": 382,
    "removeGroutSfPerHour": 95.49,
    "sawCutLfPerHour": 114.58,
    "edgeFinishLfPerHour": 20,
    "handlingItemsPerHour": 44,
    "cleanSealSfPerHour": 176
  }
  $defaults$::jsonb,
  'TenOps migration',
  'Initial workbook-supported estimating assumptions.'
);

create or replace function public.proposal_empty_estimate_inputs()
returns jsonb
language sql
immutable
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'geometryProfile','flat',
    'customerQuantity',null,
    'lengthInches',null,
    'widthInches',null,
    'riserHeightInches',null,
    'thicknessInches',null,
    'depthInches',null,
    'roughLengthInches',null,
    'roughWidthInches',null,
    'roughThicknessInches',null,
    'productionQuantityOverride',null,
    'finish','',
    'sealer','',
    'resinColor','',
    'filler','',
    'colorPlate','',
    'chipBlend','[]'::jsonb
  );
$$;

create or replace function public.proposal_estimating_defaults_payload(p_defaults_id uuid)
returns jsonb
language sql
stable
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'id',d.id,
    'version',d.version,
    'calculation_version',d.calculation_version,
    'assumptions',d.assumptions,
    'created_at',d.created_at,
    'created_by_name',d.created_by_name
  )
  from public.proposal_estimating_default_versions d
  where d.id=p_defaults_id;
$$;

create or replace function public.proposal_estimate_payload(p_proposal_id uuid)
returns jsonb
language sql
stable
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'proposal_id',e.proposal_id,
    'defaults_version_id',e.defaults_version_id,
    'defaults_version',d.version,
    'calculation_version',e.calculation_version,
    'default_assumptions',e.default_assumptions,
    'assumption_overrides',e.assumption_overrides,
    'effective_assumptions',e.effective_assumptions,
    'inputs',e.inputs,
    'outputs',e.outputs,
    'created_at',e.created_at,
    'updated_at',e.updated_at
  )
  from public.proposal_estimates e
  join public.proposal_estimating_default_versions d on d.id=e.defaults_version_id
  where e.proposal_id=p_proposal_id;
$$;

create or replace function public.get_current_proposal_estimating_defaults()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare selected_id uuid;
begin
  if not public.has_proposal_access() then
    raise exception 'TenOps Proposal access denied.' using errcode='42501';
  end if;
  select id into strict selected_id
  from public.proposal_estimating_default_versions
  order by version desc
  limit 1;
  return public.proposal_estimating_defaults_payload(selected_id);
end;
$$;

create or replace function public.save_proposal_estimating_defaults(
  p_defaults jsonb,
  p_expected_version integer,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor public.app_users%rowtype;
  prior public.proposal_estimating_default_versions%rowtype;
  created_id uuid;
begin
  if not public.has_proposal_access() then
    raise exception 'TenOps Proposal access denied.' using errcode='42501';
  end if;
  select * into strict actor from public.app_users where user_id=auth.uid() and is_active;
  perform public.proposal_validate_estimating_assumptions(p_defaults);
  if length(coalesce(p_note,'')) > 1000 then
    raise exception 'Estimating-default change note is too long.' using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('proposal-estimating-defaults',0));
  select * into strict prior
  from public.proposal_estimating_default_versions
  order by version desc
  limit 1;
  if p_expected_version is distinct from prior.version then
    raise exception 'Estimating defaults changed after this editor was opened. Reload and try again.' using errcode='40001';
  end if;

  insert into public.proposal_estimating_default_versions(
    version,calculation_version,assumptions,prior_version_id,change_note,
    created_by_user_id,created_by_name
  ) values (
    prior.version+1,'proposal-estimate-v2',p_defaults,prior.id,nullif(btrim(p_note),''),
    actor.user_id,actor.display_name
  ) returning id into created_id;
  return public.proposal_estimating_defaults_payload(created_id);
end;
$$;

create or replace function public.proposal_initialize_estimate_for_new_proposal()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  source public.proposal_estimates%rowtype;
  defaults public.proposal_estimating_default_versions%rowtype;
  empty_inputs jsonb;
begin
  if new.prior_proposal_id is not null then
    select * into source from public.proposal_estimates where proposal_id=new.prior_proposal_id;
    if found then
      insert into public.proposal_estimates(
        proposal_id,defaults_version_id,calculation_version,default_assumptions,
        assumption_overrides,effective_assumptions,inputs,outputs,
        created_by_user_id,updated_by_user_id
      ) values (
        new.id,source.defaults_version_id,source.calculation_version,source.default_assumptions,
        source.assumption_overrides,source.effective_assumptions,source.inputs,source.outputs,
        new.created_by_user_id,new.created_by_user_id
      );
      return new;
    end if;
  end if;

  select * into strict defaults
  from public.proposal_estimating_default_versions
  order by version desc
  limit 1;
  empty_inputs := public.proposal_empty_estimate_inputs();
  insert into public.proposal_estimates(
    proposal_id,defaults_version_id,calculation_version,default_assumptions,
    effective_assumptions,inputs,outputs,created_by_user_id,updated_by_user_id
  ) values (
    new.id,defaults.id,defaults.calculation_version,defaults.assumptions,
    defaults.assumptions,empty_inputs,
    public.proposal_calculate_estimate_v2(empty_inputs,defaults.assumptions),
    new.created_by_user_id,new.created_by_user_id
  );
  return new;
end;
$$;

create trigger proposals_initialize_estimate_v2
after insert on public.proposals
for each row execute function public.proposal_initialize_estimate_for_new_proposal();

create or replace function public.ensure_proposal_estimate(p_proposal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target public.proposals%rowtype;
  defaults public.proposal_estimating_default_versions%rowtype;
  actor public.app_users%rowtype;
  empty_inputs jsonb;
begin
  if not public.has_proposal_access() then
    raise exception 'TenOps Proposal access denied.' using errcode='42501';
  end if;
  if exists(select 1 from public.proposal_estimates where proposal_id=p_proposal_id) then
    return public.proposal_estimate_payload(p_proposal_id);
  end if;
  select * into strict target from public.proposals where id=p_proposal_id and status='draft' for update;
  select * into strict actor from public.app_users where user_id=auth.uid() and is_active;
  select * into strict defaults from public.proposal_estimating_default_versions order by version desc limit 1;
  empty_inputs := public.proposal_empty_estimate_inputs();
  insert into public.proposal_estimates(
    proposal_id,defaults_version_id,calculation_version,default_assumptions,
    effective_assumptions,inputs,outputs,created_by_user_id,updated_by_user_id
  ) values (
    target.id,defaults.id,defaults.calculation_version,defaults.assumptions,
    defaults.assumptions,empty_inputs,
    public.proposal_calculate_estimate_v2(empty_inputs,defaults.assumptions),
    actor.user_id,actor.user_id
  ) on conflict(proposal_id) do nothing;
  return public.proposal_estimate_payload(p_proposal_id);
end;
$$;

create or replace function public.save_proposal_estimate_draft(
  p_proposal_id uuid,
  p_inputs jsonb,
  p_overrides jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor public.app_users%rowtype;
  estimate public.proposal_estimates%rowtype;
  effective jsonb;
  unknown_key text;
  calculated jsonb;
begin
  if not public.has_proposal_access() then
    raise exception 'TenOps Proposal access denied.' using errcode='42501';
  end if;
  if coalesce(jsonb_typeof(p_overrides),'') <> 'object' then
    raise exception 'Estimate assumption overrides must be a JSON object.' using errcode='22023';
  end if;
  perform public.ensure_proposal_estimate(p_proposal_id);
  select * into strict estimate
  from public.proposal_estimates
  where proposal_id=p_proposal_id
    and exists(select 1 from public.proposals p where p.id=p_proposal_id and p.status='draft')
  for update;
  select * into strict actor from public.app_users where user_id=auth.uid() and is_active;
  select override_key into unknown_key
  from jsonb_object_keys(p_overrides) as keys(override_key)
  where not (estimate.default_assumptions ? override_key)
  limit 1;
  if unknown_key is not null then
    raise exception 'Unknown Estimate assumption override: %.',unknown_key using errcode='22023';
  end if;
  effective := estimate.default_assumptions || p_overrides;
  perform public.proposal_validate_estimating_assumptions(effective);
  perform public.proposal_validate_estimate_inputs(p_inputs);
  if estimate.calculation_version <> 'proposal-estimate-v2' then
    raise exception 'This Estimate uses an unsupported calculation version.' using errcode='55000';
  end if;
  calculated := public.proposal_calculate_estimate_v2(p_inputs,effective);
  update public.proposal_estimates set
    assumption_overrides=p_overrides,
    effective_assumptions=effective,
    inputs=p_inputs,
    outputs=calculated,
    updated_by_user_id=actor.user_id
  where proposal_id=p_proposal_id;
  return public.proposal_estimate_payload(p_proposal_id);
end;
$$;

create or replace function public.save_proposal_draft(p_proposal jsonb,p_lines jsonb)
returns void
language plpgsql
security definer
set search_path=pg_catalog,public
as $$
declare
  pid uuid := (p_proposal ->> 'id')::uuid;
  subtotal_value numeric;
  tax_value numeric;
  total_value numeric;
  existing_v2_lines jsonb;
begin
  if not public.has_proposal_access() then
    raise exception 'TenOps Proposal access denied.' using errcode='42501';
  end if;
  if not exists(select 1 from public.proposals where id=pid and status='draft') then
    raise exception 'Only Proposal drafts can be saved.' using errcode='55000';
  end if;
  if coalesce(jsonb_typeof(p_lines),'') <> 'array' or jsonb_array_length(p_lines)>100 then
    raise exception 'Invalid Proposal lines.' using errcode='22023';
  end if;

  select coalesce(sum(
    case
      when coalesce(nullif(line ->> 'line_type',''),'product') in ('included','informational') then 0
      else round(coalesce(nullif(line ->> 'quantity','')::numeric,0) * coalesce(nullif(line ->> 'rate','')::numeric,0),2)
    end
  ),0)
  into subtotal_value
  from jsonb_array_elements(p_lines) line;

  tax_value := case
    when coalesce((p_proposal ->> 'tax_enabled')::boolean,false)
      then round(subtotal_value * coalesce(nullif(p_proposal ->> 'tax_rate','')::numeric,0) / 100,2)
    else 0
  end;
  total_value := subtotal_value + tax_value;

  -- V1 clients do not send Proposal V2 geometry keys. Retain those values by
  -- display position unless a key is explicitly present in the incoming row.
  select coalesce(jsonb_agg(jsonb_build_object(
    'geometry_profile',geometry_profile,
    'dimension_applicability',dimension_applicability,
    'length_inches',length_inches,
    'width_inches',width_inches,
    'riser_height_inches',riser_height_inches,
    'thickness_inches',thickness_inches,
    'cubic_feet',cubic_feet,
    'linear_feet',linear_feet,
    'estimated_weight_pounds',estimated_weight_pounds
  ) order by display_order),'[]'::jsonb)
  into existing_v2_lines
  from public.proposal_lines
  where proposal_id=pid;

  update public.proposals set
    proposal_date=(p_proposal ->> 'proposal_date')::date,
    customer_name=left(coalesce(p_proposal ->> 'customer_name',''),500),
    customer_address=left(coalesce(p_proposal ->> 'customer_address',''),2000),
    customer_contact=left(coalesce(p_proposal ->> 'customer_contact',''),1000),
    customer_street=case when p_proposal ? 'customer_street' then left(coalesce(p_proposal ->> 'customer_street',''),1000) else customer_street end,
    customer_city=case when p_proposal ? 'customer_city' then left(coalesce(p_proposal ->> 'customer_city',''),200) else customer_city end,
    customer_state=case when p_proposal ? 'customer_state' then left(coalesce(p_proposal ->> 'customer_state',''),100) else customer_state end,
    customer_postal_code=case when p_proposal ? 'customer_postal_code' then left(coalesce(p_proposal ->> 'customer_postal_code',''),40) else customer_postal_code end,
    customer_contact_name=case when p_proposal ? 'customer_contact_name' then left(coalesce(p_proposal ->> 'customer_contact_name',''),300) else customer_contact_name end,
    customer_office_phone=case when p_proposal ? 'customer_office_phone' then left(coalesce(p_proposal ->> 'customer_office_phone',''),100) else customer_office_phone end,
    customer_mobile_phone=case when p_proposal ? 'customer_mobile_phone' then left(coalesce(p_proposal ->> 'customer_mobile_phone',''),100) else customer_mobile_phone end,
    customer_email=case when p_proposal ? 'customer_email' then left(coalesce(p_proposal ->> 'customer_email',''),320) else customer_email end,
    project_name=left(coalesce(p_proposal ->> 'project_name',''),500),
    project_number=left(coalesce(p_proposal ->> 'project_number',''),100),
    project_location=left(coalesce(p_proposal ->> 'project_location',''),500),
    side_mark=left(coalesce(p_proposal ->> 'side_mark',''),500),
    sales_rep=left(coalesce(p_proposal ->> 'sales_rep',''),200),
    terms=left(coalesce(p_proposal ->> 'terms',''),500),
    valid_days=coalesce(nullif(p_proposal ->> 'valid_days','')::integer,30),
    requested_delivery=left(coalesce(p_proposal ->> 'requested_delivery',''),500),
    fob=left(coalesce(p_proposal ->> 'fob',''),500),
    destination_zip=left(coalesce(p_proposal ->> 'destination_zip',''),20),
    tax_county=left(coalesce(p_proposal ->> 'tax_county',''),100),
    submitted_by_name=left(coalesce(p_proposal ->> 'submitted_by_name',''),200),
    submitted_by_phone=left(coalesce(p_proposal ->> 'submitted_by_phone',''),100),
    submitted_by_email=left(coalesce(p_proposal ->> 'submitted_by_email',''),320),
    notes=left(coalesce(p_proposal ->> 'notes',''),30000),
    disclaimer_snapshot=left(coalesce(p_proposal ->> 'disclaimer_snapshot',''),30000),
    formula_snapshot=left(coalesce(p_proposal ->> 'formula_snapshot',''),30000),
    proposal_field_sources=coalesce(p_proposal -> 'proposal_field_sources','{}'::jsonb),
    tax_enabled=coalesce((p_proposal ->> 'tax_enabled')::boolean,false),
    tax_rate=nullif(p_proposal ->> 'tax_rate','')::numeric,
    subtotal=subtotal_value,
    tax=tax_value,
    total=total_value
  where id=pid;

  delete from public.proposal_lines where proposal_id=pid;
  insert into public.proposal_lines(
    proposal_id,line_type,item_number,description,ref,color_plate,quantity,unit,
    length,width,height_thickness,cft,lf,estimated_weight,rate,total,
    source_metadata,display_order,geometry_profile,dimension_applicability,
    length_inches,width_inches,riser_height_inches,thickness_inches,
    cubic_feet,linear_feet,estimated_weight_pounds
  )
  select
    pid,
    coalesce(nullif(line ->> 'line_type',''),'product'),
    coalesce(line ->> 'item_number',''),
    coalesce(line ->> 'description',''),
    coalesce(line ->> 'ref',''),
    coalesce(line ->> 'color_plate',''),
    nullif(line ->> 'quantity','')::numeric,
    coalesce(line ->> 'unit',''),
    coalesce(line ->> 'length',''),
    coalesce(line ->> 'width',''),
    coalesce(line ->> 'height_thickness',''),
    coalesce(line ->> 'cft',''),
    coalesce(line ->> 'lf',''),
    coalesce(line ->> 'estimated_weight',''),
    nullif(line ->> 'rate','')::numeric,
    case
      when coalesce(nullif(line ->> 'line_type',''),'product') in ('included','informational') then 0
      else round(coalesce(nullif(line ->> 'quantity','')::numeric,0) * coalesce(nullif(line ->> 'rate','')::numeric,0),2)
    end,
    coalesce(line -> 'source_metadata','{}'::jsonb),
    ordinality-1,
    case when line ? 'geometry_profile'
      then nullif(line ->> 'geometry_profile','')
      else nullif((existing_v2_lines -> ((ordinality-1)::integer)) ->> 'geometry_profile','') end,
    case when line ? 'dimension_applicability'
      then coalesce(nullif(line -> 'dimension_applicability','null'::jsonb),'{}'::jsonb)
      else coalesce(nullif((existing_v2_lines -> ((ordinality-1)::integer)) -> 'dimension_applicability','null'::jsonb),'{}'::jsonb) end,
    case when line ? 'length_inches'
      then nullif(line ->> 'length_inches','')::numeric
      else nullif((existing_v2_lines -> ((ordinality-1)::integer)) ->> 'length_inches','')::numeric end,
    case when line ? 'width_inches'
      then nullif(line ->> 'width_inches','')::numeric
      else nullif((existing_v2_lines -> ((ordinality-1)::integer)) ->> 'width_inches','')::numeric end,
    case when line ? 'riser_height_inches'
      then nullif(line ->> 'riser_height_inches','')::numeric
      else nullif((existing_v2_lines -> ((ordinality-1)::integer)) ->> 'riser_height_inches','')::numeric end,
    case when line ? 'thickness_inches'
      then nullif(line ->> 'thickness_inches','')::numeric
      else nullif((existing_v2_lines -> ((ordinality-1)::integer)) ->> 'thickness_inches','')::numeric end,
    case when line ? 'cubic_feet'
      then nullif(line ->> 'cubic_feet','')::numeric
      else nullif((existing_v2_lines -> ((ordinality-1)::integer)) ->> 'cubic_feet','')::numeric end,
    case when line ? 'linear_feet'
      then nullif(line ->> 'linear_feet','')::numeric
      else nullif((existing_v2_lines -> ((ordinality-1)::integer)) ->> 'linear_feet','')::numeric end,
    case when line ? 'estimated_weight_pounds'
      then nullif(line ->> 'estimated_weight_pounds','')::numeric
      else nullif((existing_v2_lines -> ((ordinality-1)::integer)) ->> 'estimated_weight_pounds','')::numeric end
  from jsonb_array_elements(p_lines) with ordinality as valueset(line,ordinality);
end;
$$;

-- One PostgREST call keeps customer fields, commercial clarifications, lines,
-- and private Estimate state on the same transaction boundary.
create or replace function public.save_proposal_v2_draft(
  p_proposal jsonb,
  p_lines jsonb,
  p_estimate_inputs jsonb,
  p_estimate_overrides jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public
as $$
declare
  proposal_id uuid := (p_proposal ->> 'id')::uuid;
begin
  if not public.has_proposal_access() then
    raise exception 'TenOps Proposal access denied.' using errcode='42501';
  end if;
  perform public.save_proposal_draft(p_proposal,p_lines);
  perform public.save_proposal_clarifications(p_proposal);
  return public.save_proposal_estimate_draft(
    proposal_id,
    p_estimate_inputs,
    p_estimate_overrides
  );
end;
$$;

create or replace function public.issue_proposal(p_proposal_id uuid)
returns public.proposals
language plpgsql
security definer
set search_path=pg_catalog,public
as $$
declare
  result public.proposals;
  estimate public.proposal_estimates%rowtype;
  snapshot jsonb;
  subtotal_value numeric;
  tax_value numeric;
begin
  if not public.has_proposal_access() then
    raise exception 'TenOps Proposal access denied.' using errcode='42501';
  end if;
  perform 1 from public.proposals where id=p_proposal_id and status='draft' for update;
  if not found then
    raise exception 'Proposal draft not found.' using errcode='55000';
  end if;

  update public.proposal_lines set total=case
    when line_type in ('included','informational') then 0
    else round(coalesce(quantity,0)*coalesce(rate,0),2)
  end
  where proposal_id=p_proposal_id;
  select coalesce(sum(total),0) into subtotal_value
  from public.proposal_lines where proposal_id=p_proposal_id;
  select case when tax_enabled then round(subtotal_value*coalesce(tax_rate,0)/100,2) else 0 end
    into tax_value from public.proposals where id=p_proposal_id;
  update public.proposals set subtotal=subtotal_value,tax=tax_value,total=subtotal_value+tax_value
  where id=p_proposal_id;

  -- A draft that predates Proposal V2 acquires the current defaults at its
  -- explicit issue gate. Existing issued history remains untouched.
  perform public.ensure_proposal_estimate(p_proposal_id);
  select * into strict estimate
  from public.proposal_estimates
  where proposal_id=p_proposal_id
  for update;
  if estimate.calculation_version <> 'proposal-estimate-v2' then
    raise exception 'This Estimate uses an unsupported calculation version.' using errcode='55000';
  end if;
  perform public.proposal_validate_estimating_assumptions(estimate.effective_assumptions);
  perform public.proposal_validate_estimate_inputs(estimate.inputs);
  update public.proposal_estimates set
    outputs=public.proposal_calculate_estimate_v2(estimate.inputs,estimate.effective_assumptions),
    updated_by_user_id=auth.uid()
  where proposal_id=p_proposal_id;

  select to_jsonb(p) || jsonb_build_object(
    'lines',(
      select coalesce(jsonb_agg(to_jsonb(l) order by l.display_order),'[]'::jsonb)
      from public.proposal_lines l where l.proposal_id=p.id
    ),
    'estimate',public.proposal_estimate_payload(p.id)
  ) into snapshot
  from public.proposals p
  where p.id=p_proposal_id;

  if btrim(snapshot ->> 'customer_name')=''
     or not exists(
       select 1 from public.proposal_lines
       where proposal_id=p_proposal_id and btrim(description)<>'' and quantity is not null
     ) then
    raise exception 'Customer and at least one described line with Quantity are required.' using errcode='22023';
  end if;

  update public.proposals set
    status='issued',issued_snapshot=snapshot,issued_at=clock_timestamp(),issued_by_user_id=auth.uid()
  where id=p_proposal_id returning * into result;
  insert into public.proposal_pdf_documents(proposal_id,document_version,status)
  values(p_proposal_id,'proposal-pdf-v2','pending');
  return result;
end;
$$;

create or replace function public.create_proposal_revision(p_proposal_id uuid)
returns uuid
language plpgsql
security definer
set search_path=pg_catalog,public
as $$
declare
  source public.proposals%rowtype;
  created_id uuid := gen_random_uuid();
  next_minor integer;
begin
  if not public.has_proposal_access() then
    raise exception 'TenOps Proposal access denied.' using errcode='42501';
  end if;
  select * into strict source from public.proposals where id=p_proposal_id and status='issued';
  select coalesce(max(version_minor),source.version_minor)+1 into next_minor
  from public.proposals where lineage_id=source.lineage_id and version_major=source.version_major;

  insert into public.proposals(
    id,job_id,lineage_id,prior_proposal_id,estimate_base,version_major,version_minor,
    estimate_number,status,proposal_date,customer_name,customer_address,customer_contact,
    customer_street,customer_city,customer_state,customer_postal_code,customer_contact_name,
    customer_office_phone,customer_mobile_phone,customer_email,
    project_name,project_number,project_location,side_mark,sales_rep,terms,valid_days,
    requested_delivery,fob,destination_zip,tax_county,submitted_by_name,submitted_by_phone,
    submitted_by_email,notes,disclaimer_snapshot,formula_snapshot,proposal_field_sources,
    tax_enabled,tax_rate,subtotal,tax,total,freight_estimate,preliminary_drawings_attached,
    crating_included,cut_tickets_included,field_dimensioning_excluded,
    created_by_user_id,created_by_name
  ) select
    created_id,job_id,lineage_id,id,estimate_base,version_major,next_minor,
    estimate_base||'-'||version_major||'.'||next_minor,'draft',current_date,
    customer_name,customer_address,customer_contact,
    customer_street,customer_city,customer_state,customer_postal_code,customer_contact_name,
    customer_office_phone,customer_mobile_phone,customer_email,
    project_name,project_number,project_location,side_mark,sales_rep,terms,valid_days,
    requested_delivery,fob,destination_zip,tax_county,submitted_by_name,submitted_by_phone,
    submitted_by_email,notes,disclaimer_snapshot,formula_snapshot,proposal_field_sources,
    tax_enabled,tax_rate,subtotal,tax,total,freight_estimate,preliminary_drawings_attached,
    crating_included,cut_tickets_included,field_dimensioning_excluded,
    auth.uid(),(select display_name from public.app_users where user_id=auth.uid())
  from public.proposals where id=source.id;

  insert into public.proposal_lines(
    proposal_id,line_type,item_number,description,ref,color_plate,quantity,unit,
    length,width,height_thickness,cft,lf,estimated_weight,rate,total,source_metadata,
    display_order,geometry_profile,dimension_applicability,length_inches,width_inches,
    riser_height_inches,thickness_inches,cubic_feet,linear_feet,estimated_weight_pounds
  ) select
    created_id,line_type,item_number,description,ref,color_plate,quantity,unit,
    length,width,height_thickness,cft,lf,estimated_weight,rate,total,source_metadata,
    display_order,geometry_profile,dimension_applicability,length_inches,width_inches,
    riser_height_inches,thickness_inches,cubic_feet,linear_feet,estimated_weight_pounds
  from public.proposal_lines where proposal_id=source.id;
  return created_id;
end;
$$;

create or replace function public.proposal_estimating_defaults_immutable()
returns trigger
language plpgsql
set search_path=pg_catalog,public
as $$
begin
  raise exception 'Estimating default versions are append-only.' using errcode='55000';
end;
$$;

create trigger proposal_estimating_defaults_immutable
before update or delete on public.proposal_estimating_default_versions
for each row execute function public.proposal_estimating_defaults_immutable();

create or replace function public.proposal_estimate_issued_immutable()
returns trigger
language plpgsql
set search_path=pg_catalog,public
as $$
declare target_proposal_id uuid := old.proposal_id;
begin
  if exists(select 1 from public.proposals p where p.id=target_proposal_id and p.status='issued')
     and not (
       tg_op='DELETE'
       and current_setting('tenops.admin_proposal_delete',true)=target_proposal_id::text
       and exists(
         select 1 from public.app_users
         where user_id=auth.uid() and is_active and role='admin'
       )
     ) then
    raise exception 'Issued Proposal Estimates are immutable. Create a revision.' using errcode='55000';
  end if;
  return case when tg_op='DELETE' then old else new end;
end;
$$;

create trigger proposal_estimate_issued_immutable
before update or delete on public.proposal_estimates
for each row execute function public.proposal_estimate_issued_immutable();

create trigger proposal_estimates_touch_updated_at
before update on public.proposal_estimates
for each row execute function public.tenops_touch_updated_at();

alter table public.proposal_estimating_default_versions enable row level security;
alter table public.proposal_estimates enable row level security;

create policy proposal_estimating_defaults_authorized_read
  on public.proposal_estimating_default_versions for select to authenticated
  using (public.has_proposal_access());
create policy proposal_estimates_authorized_read
  on public.proposal_estimates for select to authenticated
  using (public.has_proposal_access());

revoke all on public.proposal_estimating_default_versions,public.proposal_estimates
  from public,anon,authenticated;
grant select on public.proposal_estimating_default_versions,public.proposal_estimates
  to authenticated;
grant all on public.proposal_estimating_default_versions,public.proposal_estimates
  to service_role;

-- All application writes now travel through checked, server-authoritative RPCs.
revoke insert,update,delete on public.proposals,public.proposal_lines from authenticated;

alter function public.proposal_validate_estimating_assumptions(jsonb) owner to postgres;
alter function public.proposal_validate_estimate_inputs(jsonb) owner to postgres;
alter function public.proposal_calculate_estimate_v2(jsonb,jsonb) owner to postgres;
alter function public.proposal_empty_estimate_inputs() owner to postgres;
alter function public.proposal_estimating_defaults_payload(uuid) owner to postgres;
alter function public.proposal_estimate_payload(uuid) owner to postgres;
alter function public.get_current_proposal_estimating_defaults() owner to postgres;
alter function public.save_proposal_estimating_defaults(jsonb,integer,text) owner to postgres;
alter function public.proposal_initialize_estimate_for_new_proposal() owner to postgres;
alter function public.ensure_proposal_estimate(uuid) owner to postgres;
alter function public.save_proposal_estimate_draft(uuid,jsonb,jsonb) owner to postgres;
alter function public.save_proposal_draft(jsonb,jsonb) owner to postgres;
alter function public.save_proposal_v2_draft(jsonb,jsonb,jsonb,jsonb) owner to postgres;
alter function public.issue_proposal(uuid) owner to postgres;
alter function public.create_proposal_revision(uuid) owner to postgres;
alter function public.proposal_estimating_defaults_immutable() owner to postgres;
alter function public.proposal_estimate_issued_immutable() owner to postgres;

revoke all on function public.proposal_validate_estimating_assumptions(jsonb) from public,anon,authenticated;
revoke all on function public.proposal_validate_estimate_inputs(jsonb) from public,anon,authenticated;
revoke all on function public.proposal_calculate_estimate_v2(jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.proposal_empty_estimate_inputs() from public,anon,authenticated;
revoke all on function public.proposal_estimating_defaults_payload(uuid) from public,anon,authenticated;
revoke all on function public.proposal_estimate_payload(uuid) from public,anon,authenticated;
revoke all on function public.proposal_initialize_estimate_for_new_proposal() from public,anon,authenticated;
revoke all on function public.proposal_estimating_defaults_immutable() from public,anon,authenticated;
revoke all on function public.proposal_estimate_issued_immutable() from public,anon,authenticated;

revoke all on function public.get_current_proposal_estimating_defaults() from public,anon;
revoke all on function public.save_proposal_estimating_defaults(jsonb,integer,text) from public,anon;
revoke all on function public.ensure_proposal_estimate(uuid) from public,anon;
revoke all on function public.save_proposal_estimate_draft(uuid,jsonb,jsonb) from public,anon;
revoke all on function public.save_proposal_draft(jsonb,jsonb) from public,anon;
revoke all on function public.save_proposal_v2_draft(jsonb,jsonb,jsonb,jsonb) from public,anon;
revoke all on function public.issue_proposal(uuid) from public,anon;
revoke all on function public.create_proposal_revision(uuid) from public,anon;

grant execute on function public.get_current_proposal_estimating_defaults() to authenticated,service_role;
grant execute on function public.save_proposal_estimating_defaults(jsonb,integer,text) to authenticated,service_role;
grant execute on function public.ensure_proposal_estimate(uuid) to authenticated,service_role;
grant execute on function public.save_proposal_estimate_draft(uuid,jsonb,jsonb) to authenticated,service_role;
grant execute on function public.save_proposal_draft(jsonb,jsonb) to authenticated,service_role;
grant execute on function public.save_proposal_v2_draft(jsonb,jsonb,jsonb,jsonb) to authenticated,service_role;
grant execute on function public.issue_proposal(uuid) to authenticated,service_role;
grant execute on function public.create_proposal_revision(uuid) to authenticated,service_role;

comment on table public.proposal_estimating_default_versions is
  'Append-only canonical Proposal estimating defaults. Each Estimate captures one version; later changes affect only newly initialized Estimates.';
comment on table public.proposal_estimates is
  'Financially private Proposal Estimate state with captured defaults, explicit overrides, canonical inputs, and server-calculated outputs.';
comment on column public.proposal_lines.height_thickness is
  'Legacy combined H/T display value. Proposal V2 does not reinterpret it; use separate nullable geometry columns.';

commit;
