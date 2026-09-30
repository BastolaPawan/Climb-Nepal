<?php
declare(strict_types=1);

function guide_checklist_definitions(): array
{
    return [
        'before' => ['title' => 'Before Trek', 'tasks' => [
            'Confirm trek dates and guest count', 'Review guest list and emergency contacts',
            'Check guest medical and allergy information', 'Confirm transportation and accommodation',
            'Confirm route permits and registration requirements', 'Review route, itinerary and altitude profile',
            'Check weather forecast and trail conditions', 'Check current trekking notices or restrictions',
            'Confirm agency, local and emergency contacts', 'Review evacuation options and contingency plans',
            'Confirm guest insurance information', 'Confirm communication method for the route',
        ]],
        'documents' => ['title' => 'Documents & Permits', 'tasks' => [
            'Check passport or ID information', 'Check required trekking permits',
            'Check national park or conservation area permit', 'Check TIMS or applicable registration',
            'Check guest insurance information', 'Prepare guest emergency contact list',
            'Save accommodation confirmations', 'Save transportation confirmations',
            'Prepare required guide and company documents', 'Back up digital document copies',
            'Pack required physical document copies',
        ]],
        'briefing' => ['title' => 'Guest Briefing', 'tasks' => [
            'Introduce the guide and trekking team', 'Explain itinerary and expected daily schedule',
            'Explain walking pace and group expectations', 'Explain altitude and acclimatization plan',
            'Explain symptoms guests should report promptly', 'Explain hydration and meal arrangements',
            'Explain clothing layers and appropriate footwear', 'Explain toilet and bathroom arrangements',
            'Explain accommodation and drinking water arrangements', 'Explain charging and electricity availability',
            'Explain communication limitations on the route', 'Explain emergency procedures and group rules',
            'Explain environmental practices and local customs', 'Invite questions and confirm understanding',
        ]],
        'packing_personal' => ['title' => 'Bag Packing · Guide Gear', 'tasks' => [
            'Trekking boots', 'Trekking trousers and base layers', 'Fleece and warm jacket',
            'Waterproof jacket and trousers', 'Gloves, hat and sunglasses', 'Headlamp and spare batteries',
            'Sleeping bag if required', 'Water bottle and backpack', 'Duffel or porter bag if applicable',
        ]],
        'packing_navigation' => ['title' => 'Bag Packing · Navigation & Comms', 'tasks' => [
            'Phone and charging cables', 'Power bank', 'GPS or navigation device if used',
            'Maps and compass if required', 'Satellite phone if required', 'Emergency communication device if available',
        ]],
        'packing_safety' => ['title' => 'Bag Packing · First Aid & Safety', 'tasks' => [
            'First-aid kit and required supplies', 'Basic wound-care supplies', 'Blister care supplies',
            'Personal medications and required medical supplies', 'Emergency supplies and emergency blanket',
            'Trek-appropriate rescue and safety equipment',
        ]],
        'packing_documents' => ['title' => 'Bag Packing · Documents', 'tasks' => [
            'Passport or ID copies', 'Permits and registrations', 'Insurance information', 'Guest list and emergency contacts',
            'Accommodation and transportation details', 'Agency and local contact details',
        ]],
        'packing_other' => ['title' => 'Bag Packing · Other', 'tasks' => [
            'Cash', 'Trash bags', 'Water purification supplies if required', 'Notebook and pen',
            'Camera if required', 'Spare batteries',
        ]],
        'safety' => ['title' => 'Safety & Emergency', 'tasks' => [
            'Keep emergency contact list available', 'Keep local emergency contacts available',
            'Review evacuation options for the route', 'Identify nearest health facilities along the route',
            'Check communication device and backup power', 'Check emergency equipment',
            'Review current weather alerts and trail hazards', 'Confirm group location and check-in plan',
            'Record incident information when required', 'Inform the agency when necessary',
        ]],
        'end' => ['title' => 'End of Trek & Reporting', 'tasks' => [
            'Confirm all guests completed the trek safely', 'Confirm guest transportation and final accommodation',
            'Return rented equipment', 'Check and return agency equipment', 'Check guide equipment',
            'Review outstanding payments and expenses', 'Record trek expenses', 'Collect guest feedback',
            'Record incidents and follow-up actions', 'Complete trek report', 'Save important trek documents',
            'Mark trek as completed',
        ]],
    ];
}

function guide_daily_tasks(): array
{
    return [
        'Morning' => ['Check weather and route conditions', 'Check guest health and reported symptoms',
            'Check water and breakfast arrangements', 'Confirm required gear and porter arrangements',
            'Give morning briefing and confirm departure time', 'Count guests before departure'],
        'During Trek' => ['Monitor group pace and condition', 'Check hydration and rest breaks',
            'Check route and weather changes', 'Confirm lunch arrangement', 'Count guests regularly',
            'Monitor altitude-related symptoms', 'Record important incidents'],
        'Arrival' => ['Count guests and confirm safe arrival', 'Check accommodation and room allocation',
            'Confirm meals and check guest condition', 'Review next-day route and weather',
            'Confirm next-day departure time', 'Prepare next-day requirements'],
    ];
}