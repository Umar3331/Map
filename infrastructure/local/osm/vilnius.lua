local schema = 'osm'

local function text_columns(geometry_type)
    return {
        { column = 'class', type = 'text', not_null = true },
        { column = 'name', type = 'text' },
        { column = 'geom', type = geometry_type, projection = 3857, not_null = true },
    }
end

local transportation = osm2pgsql.define_way_table('transportation', {
    { column = 'class', type = 'text', not_null = true },
    { column = 'name', type = 'text' },
    { column = 'ref', type = 'text' },
    { column = 'bridge', type = 'text' },
    { column = 'tunnel', type = 'text' },
    { column = 'geom', type = 'linestring', projection = 3857, not_null = true },
}, { schema = schema })

local waterways = osm2pgsql.define_way_table('waterways', text_columns('linestring'), { schema = schema })
local railways = osm2pgsql.define_way_table('railways', text_columns('linestring'), { schema = schema })
local boundaries = osm2pgsql.define_area_table('boundaries', {
    { column = 'class', type = 'text', not_null = true },
    { column = 'name', type = 'text' },
    { column = 'admin_level', type = 'text' },
    { column = 'geom', type = 'multilinestring', projection = 3857, not_null = true },
}, { schema = schema })

local buildings = osm2pgsql.define_area_table('buildings', text_columns('multipolygon'), { schema = schema })
local water = osm2pgsql.define_area_table('water', text_columns('multipolygon'), { schema = schema })
local landuse = osm2pgsql.define_area_table('landuse', text_columns('multipolygon'), { schema = schema })
local places = osm2pgsql.define_node_table('places', text_columns('point'), { schema = schema })

local function nonempty(value)
    if value and value ~= '' then return value end
    return nil
end

local function area_class(tags)
    if tags.leisure == 'park' or tags.leisure == 'garden' or tags.leisure == 'nature_reserve' then
        return tags.leisure
    end
    if tags.natural == 'wood' or tags.landuse == 'forest' then return 'forest' end
    return nonempty(tags.landuse) or nonempty(tags.leisure) or nonempty(tags.natural)
end

local function is_water(tags)
    return tags.natural == 'water' or tags.water ~= nil or tags.landuse == 'reservoir'
end

local function insert_area(table, object, class, is_relation)
    local geometry
    if not is_relation then
        if not object.is_closed then return end
        geometry = object:as_polygon()
    else
        if object.tags.type ~= 'multipolygon' and object.tags.type ~= 'boundary' then return end
        geometry = object:as_multipolygon()
    end
    if geometry:is_null() then return end
    table:insert({ class = class, name = nonempty(object.tags.name), geom = geometry })
end

local function process_areas(object, is_relation)
    local tags = object.tags
    if tags.building then insert_area(buildings, object, tags.building, is_relation) end
    if is_water(tags) then
        insert_area(water, object, nonempty(tags.water) or nonempty(tags.natural) or 'reservoir', is_relation)
    end
    local class = area_class(tags)
    if class and not is_water(tags) then insert_area(landuse, object, class, is_relation) end
end

function osm2pgsql.process_node(object)
    if object.tags.place and object.tags.name then
        places:insert({
            class = object.tags.place,
            name = object.tags.name,
            geom = object:as_point(),
        })
    end
end

function osm2pgsql.process_way(object)
    local tags = object.tags
    if tags.highway then
        transportation:insert({
            class = tags.highway,
            name = nonempty(tags.name),
            ref = nonempty(tags.ref),
            bridge = nonempty(tags.bridge),
            tunnel = nonempty(tags.tunnel),
            geom = object:as_linestring(),
        })
    end
    if tags.waterway and tags.waterway ~= 'riverbank' then
        waterways:insert({ class = tags.waterway, name = nonempty(tags.name), geom = object:as_linestring() })
    end
    if tags.railway and tags.railway ~= 'abandoned' and tags.railway ~= 'razed' then
        railways:insert({ class = tags.railway, name = nonempty(tags.name), geom = object:as_linestring() })
    end
    if tags.boundary == 'administrative' then
        boundaries:insert({
            class = tags.boundary,
            name = nonempty(tags.name),
            admin_level = nonempty(tags.admin_level),
            geom = object:as_multilinestring(),
        })
    end
    process_areas(object, false)
end

function osm2pgsql.process_relation(object)
    if object.tags.boundary == 'administrative' then
        local geometry = object:as_multilinestring()
        if not geometry:is_null() then
            boundaries:insert({
                class = object.tags.boundary,
                name = nonempty(object.tags.name),
                admin_level = nonempty(object.tags.admin_level),
                geom = geometry,
            })
        end
    end
    process_areas(object, true)
end
