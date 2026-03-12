/**
 * Normalizes a raw listing object into a flat, snake_case record.
 *
 * @param {object} item - Raw listing object from feed or merged with detail data
 * @param {object} options - { debugLog }
 * @returns {object} Normalized_Record with snake_case fields
 */
export function normalizeListing(item, options = {}) {
    const { debugLog = false } = options;

    const token = item.token ?? item.id ?? null;
    const manufacturerText = item.manufacturer?.text ?? null;
    const modelText = item.model?.text ?? null;

    // Derive title: use raw title, or construct from manufacturer + model + subModel
    const title = item.title
        ?? (manufacturerText && modelText ? `${manufacturerText} ${modelText}` : null);

    // Derive images array: metaData.images > metaData.coverImage > top-level images
    let images = [];
    if (Array.isArray(item.metaData?.images) && item.metaData.images.length > 0) {
        images = item.metaData.images;
    } else if (Array.isArray(item.images) && item.images.length > 0) {
        images = item.images;
    } else if (item.metaData?.coverImage) {
        images = [item.metaData.coverImage];
    }

    // Derive seller_type: "dealer" if merchant is truthy, agencyName exists, or adType is "commercial" with agency
    const hasDealer = !!item.merchant
        || (typeof item.customer?.agencyName === 'string' && item.customer.agencyName.length > 0);
    const sellerType = hasDealer ? 'dealer' : 'private';

    // Derive dealer_name from customer.agencyName
    const dealerName = (typeof item.customer?.agencyName === 'string' && item.customer.agencyName.length > 0)
        ? item.customer.agencyName
        : null;

    // Price: 0 means "no price specified" on Yad2
    const price = (item.price != null && item.price !== 0) ? item.price : null;

    const record = {
        item_id: token != null ? String(token) : null,
        item_url: token != null ? `https://www.yad2.co.il/vehicles/item/${token}` : null,
        source: 'yad2',
        insertion_time: new Date().toISOString(),
        item_time: item.dates?.updatedAt ?? item.date ?? item.updatedAt ?? null,
        title,
        price,
        currency: item.currency ?? 'ILS',
        manufacturer: manufacturerText,
        model: modelText,
        sub_model: item.subModel?.text ?? null,
        year: item.vehicleDates?.yearOfProduction ?? item.year ?? null,
        hand: item.hand?.id ?? (typeof item.hand === 'number' ? item.hand : null),
        km: item.km ?? null,
        engine_volume: item.engineVolume ?? item.engineSize ?? null,
        gearbox: item.gearBox?.text ?? item.gearbox?.text ?? null,
        fuel_type: item.engineType?.text ?? item.fuelType?.text ?? null,
        color: item.color?.text ?? null,
        ownership_type: item.owner?.text ?? item.ownershipType?.text ?? null,
        city: item.address?.city?.text ?? null,
        area: item.address?.area?.text ?? null,
        seller_type: sellerType,
        dealer_name: dealerName,
        images,
        image_count: images.length,
        description: item.metaData?.description ?? item.description ?? null,
        test_until: item.vehicleDates?.testDate ?? item.testUntil ?? null,
        vehicle_condition: item.vehicleCondition ?? null,
        previous_owners: item.previousOwners ?? null,
        phone_number_exposed: item.phone ?? null,
        geographic_location: item.coordinates ?? null,
        raw_item_type: item.adType ?? item.type ?? null,
        raw_data: debugLog ? item : null,
    };

    return record;
}
