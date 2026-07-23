begin;

alter table public.vendor_catalog
  add column if not exists vendor_sku text;

-- ARIM product codes published in its Marble & Granite catalog. Codes identify
-- the product/color; the existing catalog size remains an independent field.
with authoritative(item_name, vendor_sku) as (
  values
    ('Arim Black','B10'), ('Toros Black','B30'), ('Sooty Black','B31'),
    ('Canadian Black','B40'), ('Italian Black','B70'), ('Coal Crumbles','B80'),
    ('Shadow Black','B85'), ('Raven Black','B90'), ('American Black','B95'),
    ('Arim Brown','BR10'), ('Coffee Brown','BR31'), ('Canadian Chocolate','BR40'),
    ('Canadian Mocha','BR47'), ('Moca Cafe','BR80'),
    ('Jersey Cream','C30'), ('Boston Cream','C33'), ('Wisconsin Cream','C60'),
    ('Italian Botticino','C70'), ('Aurora Cream','C72'), ('Italian Light Beige','C75'),
    ('Persian Cream','C80'), ('Champagne','C85'), ('Missouri Botticino','C90'),
    ('Smokey Gray','G1'), ('Smokey Grey','G1'), ('Light Gray','G10'),
    ('Dolphine Gray','G20'), ('Dolphin Gray','G20'), ('Arim Gray','G21'),
    ('Storm Gray','G22'), ('Arim Blue','G25'), ('Arim Blue Coal','G26'),
    ('Canadian Blue Gray','G40'), ('Blue Bardigilio','G70'), ('Blue Bardiglio','G70'),
    ('Italian Carnico Gray','G72'), ('Gray Genoa','G73'),
    ('Dark Bardigilio','G75'), ('Dark Bardiglio','G75'),
    ('Blue Gray Marble (NC)','G90'), ('Misty Gray Marble (WA)','G91'),
    ('American Gray','G95'), ('American Grey','G95'),
    ('Arim Green','GN10'), ('Sage Green','GN30'), ('Canadian Royal Green','GN40'),
    ('Verde Alpi','GN70'), ('Dark Green','GN80'), ('Light Green','GN85'),
    ('Cardiff Green (NC)','GN90'),
    ('Arim Pink','P10'), ('Peachy Pink','P30'), ('Canadian Pink','P40'),
    ('Italian Rose','P70'), ('Rosso Levanta','P75'), ('Rosso Levanto','P75'),
    ('Arim Red','R10'), ('Philly Red','R30'), ('Red Cedar Marble (NC)','R60'),
    ('White Rose Marble (NC)','R65'), ('Red Verona','R70'), ('Royal Red','R73'),
    ('Arim White','W10'), ('New Pure White','W20'), ('Amazing White','W25'),
    ('Alaska White','W30'), ('Arim Extreme White','W35'), ('Canadian White','W40'),
    ('Snowy White','W50'), ('Georgia White','W60'), ('Sierra White','W61'),
    ('Ultra White','W65'), ('Ultra White Marble','W65'),
    ('Italian Perfect White','W70'), ('Arim Bianco Verona','W71'),
    ('Thasos White','W75'), ('Blanco Mexicano','W80'), ('Moon White','W85'),
    ('Arctic White','W88'), ('China White','W90'), ('American White','W95'),
    ('Persian Yellow','Y10'), ('Arim Yellow','Y20'), ('Real Onyx','Y35'),
    ('Light Buff','Y40'), ('Canadian Medium Buff','Y45'), ('Yellow Verona','Y70'),
    ('Italian Yellow Siena','Y75'), ('Yellow Siena','Y75'), ('Saffron Verona','Y80'),
    ('Red Granite','GRR10'), ('Black Granite','GRB10'),
    ('Salt and Pepper Granite','GRW30'), ('Salt & Pepper Granite','GRW30'),
    ('Italian Granite','GR70')
)
update public.vendor_catalog catalog
set vendor_sku = authoritative.vendor_sku
from authoritative
where lower(trim(catalog.vendor)) = 'arim'
  and lower(trim(catalog.item_name)) = lower(authoritative.item_name)
  and catalog.vendor_sku is distinct from authoritative.vendor_sku;

create index if not exists vendor_catalog_vendor_sku_search_idx
  on public.vendor_catalog (lower(vendor), lower(vendor_sku))
  where nullif(trim(vendor_sku), '') is not null;

comment on column public.vendor_catalog.vendor_sku is
  'Vendor-published product code. ARIM marble/granite values originate from ARIM public catalog references.';

commit;
