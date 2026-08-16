local schema = 'app_import'

local columns = {
    { column = 'name', type = 'text' },
    { column = 'category', type = 'text', not_null = true },
    { column = 'subcategory', type = 'text', not_null = true },
    { column = 'raw_key', type = 'text', not_null = true },
    { column = 'raw_value', type = 'text', not_null = true },
    { column = 'description', type = 'text' },
    { column = 'address_line', type = 'text' },
    { column = 'postal_code', type = 'text' },
    { column = 'city', type = 'text' },
    { column = 'country_code', type = 'text' },
    { column = 'phone', type = 'text' },
    { column = 'website', type = 'text' },
    { column = 'email', type = 'text' },
    { column = 'opening_hours_raw', type = 'text' },
}

local node_columns = {}
for _, column in ipairs(columns) do table.insert(node_columns, column) end
table.insert(node_columns, { column = 'geom', type = 'point', projection = 4326, not_null = true })

local area_columns = {}
for _, column in ipairs(columns) do table.insert(area_columns, column) end
table.insert(area_columns, { column = 'geom', type = 'multipolygon', projection = 4326, not_null = true })

local nodes = osm2pgsql.define_node_table('place_nodes', node_columns, { schema = schema })
local areas = osm2pgsql.define_area_table('place_areas', area_columns, { schema = schema })

local food = {
    restaurant = true, cafe = true, bar = true, pub = true,
    fast_food = true, ice_cream = true, biergarten = true,
}
local health_amenity = {
    pharmacy = true, clinic = true, doctors = true, dentist = true, hospital = true,
}
local finance = { bank = true, atm = true, bureau_de_change = true }
local automotive_shop = {
    car = true, car_repair = true, tyres = true, motorcycle = true,
}
local accommodation = {
    hotel = true, hostel = true, guest_house = true, motel = true, apartment = true,
}
local professional_office = {
    accountant = true, estate_agent = true, lawyer = true, insurance = true,
    financial = true, employment_agency = true, travel_agent = true,
}
local service_craft = {
    electrician = true, plumber = true, carpenter = true, locksmith = true,
    shoemaker = true, tailor = true, photographer = true,
}
local other_amenity = {
    cinema = true, theatre = true, veterinary = true, post_office = true,
}

local function nonempty(value)
    if value and value ~= '' then return value end
    return nil
end

local function classification(tags)
    if food[tags.amenity] then return 'food_drink', tags.amenity, 'amenity', tags.amenity end
    if health_amenity[tags.amenity] then return 'health', tags.amenity, 'amenity', tags.amenity end
    if tags.healthcare then return 'health', tags.healthcare, 'healthcare', tags.healthcare end
    if tags.amenity == 'fuel' or tags.amenity == 'car_wash' then
        return 'automotive', tags.amenity, 'amenity', tags.amenity
    end
    if finance[tags.amenity] then return 'finance', tags.amenity, 'amenity', tags.amenity end
    if tags.leisure == 'fitness_centre' or tags.leisure == 'sports_centre' then
        return 'fitness', tags.leisure, 'leisure', tags.leisure
    end
    if tags.shop == 'hairdresser' or tags.shop == 'beauty' or tags.shop == 'cosmetics' then
        return 'beauty', tags.shop, 'shop', tags.shop
    end
    if automotive_shop[tags.shop] then return 'automotive', tags.shop, 'shop', tags.shop end
    if tags.shop == 'chemist' or tags.shop == 'medical_supply' then
        return 'health', tags.shop, 'shop', tags.shop
    end
    if tags.shop then return 'shopping', tags.shop, 'shop', tags.shop end
    if accommodation[tags.tourism] then
        return 'accommodation', tags.tourism, 'tourism', tags.tourism
    end
    if professional_office[tags.office] then return 'services', tags.office, 'office', tags.office end
    if service_craft[tags.craft] then return 'services', tags.craft, 'craft', tags.craft end
    if other_amenity[tags.amenity] then return 'other', tags.amenity, 'amenity', tags.amenity end
    if tags.tourism == 'museum' or tags.tourism == 'attraction' then
        return 'other', tags.tourism, 'tourism', tags.tourism
    end
    return nil
end

local function address(tags)
    if nonempty(tags['addr:full']) then return tags['addr:full'] end
    local street = nonempty(tags['addr:street'])
    local number = nonempty(tags['addr:housenumber'])
    if street and number then return street .. ' ' .. number end
    return street or number
end

local function values(object)
    local category, subcategory, raw_key, raw_value = classification(object.tags)
    if not category then return nil end
    local tags = object.tags
    return {
        name = nonempty(tags.name),
        category = category,
        subcategory = subcategory,
        raw_key = raw_key,
        raw_value = raw_value,
        description = nonempty(tags.description),
        address_line = address(tags),
        postal_code = nonempty(tags['addr:postcode']),
        city = nonempty(tags['addr:city']),
        country_code = nonempty(tags['addr:country']),
        phone = nonempty(tags.phone) or nonempty(tags['contact:phone']),
        website = nonempty(tags.website) or nonempty(tags['contact:website']),
        email = nonempty(tags.email) or nonempty(tags['contact:email']),
        opening_hours_raw = nonempty(tags.opening_hours),
    }
end

function osm2pgsql.process_node(object)
    local row = values(object)
    if not row then return end
    row.geom = object:as_point()
    nodes:insert(row)
end

function osm2pgsql.process_way(object)
    if not object.is_closed then return end
    local row = values(object)
    if not row then return end
    row.geom = object:as_polygon()
    if not row.geom:is_null() then areas:insert(row) end
end

function osm2pgsql.process_relation(object)
    if object.tags.type ~= 'multipolygon' then return end
    local row = values(object)
    if not row then return end
    row.geom = object:as_multipolygon()
    if not row.geom:is_null() then areas:insert(row) end
end
