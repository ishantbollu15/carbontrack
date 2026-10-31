/**
 * ============================================================================
 * CARBON FOOTPRINT TRACKER — ADVANCED SCIENTIFIC MULTI-ENTRY ENGINE
 * Pure Vanilla JavaScript · Zero Frameworks · Zero Build Tools
 * ============================================================================
 *
 * Scientific & Methodological Enhancements:
 *   1. Commute Frequency Weighting: Accounts for 5-day workweeks vs 7-day daily travel,
 *      eliminating the 52% annual commute overstatement.
 *   2. Real-World Urban Vehicle Modes: Dedicated models for CNG cars, strong hybrids,
 *      grid-charged EVs, solar-charged EVs, e-scooters, and auto-rickshaws.
 *   3. Solar PV Net-Metering Offset: Credits solar generation against grid emissions
 *      (0.8374 kg CO₂e avoided per kWh generated) rather than adding a carbon penalty.
 *   4. Flexible Energy Billing Cycles: Supports Monthly Bill (kWh/month) vs Daily (kWh/day),
 *      smoothing seasonal AC usage spikes across billing periods.
 *   5. Indian Dairy vs Vegan Distinction: Models enteric methane in high-dairy vegetarian
 *      diets (paneer, ghee, curd) vs low-dairy and 100% plant-based vegan diets.
 *   6. Aviation Take-Off & Landing (LTO) Penalty: Accurately models the heavy fuel burn
 *      during takeoff/climb (60-140 kg CO₂e/flight) plus aerodynamic high-altitude cruising.
 *   7. Per-Capita Household & Occupancy Allocation: Divides shared home utilities by N
 *      and carpool vehicle miles by passenger count.
 *   8. Annualized Paris 1.5°C Benchmark: Grades based on metric tonnes CO₂e/year.
 */

// ============================================================================
// 1. SCIENTIFIC EMISSION FACTORS & METRICS
// ============================================================================
const CARBON_METRICS = {

    // Transport: kg CO₂e per vehicle-km or passenger-km (IPCC AR6 / DEFRA 2023 / CEA India 2023)
    transport: {
        car: {
            baseFactor: 0.171,
            isSharedByOccupancy: true,
            label: "🚗 Car (Petrol / Diesel)",
            tip: "Carpooling with colleagues or family divides vehicle emissions directly by the number of occupants."
        },
        cng_car: {
            baseFactor: 0.108,
            isSharedByOccupancy: true,
            label: "🚙 Car (CNG - Compressed Natural Gas)",
            tip: "CNG produces ~35% less CO₂ than petrol with significantly lower toxic particulate emissions."
        },
        hybrid_car: {
            baseFactor: 0.105,
            isSharedByOccupancy: true,
            label: "🔋 Hybrid Car (Petrol/Electric HEV)",
            tip: "Regenerative braking in city traffic recovers kinetic energy, cutting fuel consumption by ~35%."
        },
        electric_car: {
            // EV on national grid: ~0.18 kWh/km * (0.82 grid intensity * 1.07 T&D losses = 0.8774 kg/kWh)
            baseFactor: 0.158,
            isSharedByOccupancy: true,
            label: "⚡ Electric Vehicle (Grid Charged)",
            tip: "Zero tailpipe emissions, but powered by the grid. Switching to rooftop solar drops charging emissions by ~95%."
        },
        electric_car_solar: {
            // EV charged on rooftop solar: ~0.18 kWh/km * 0.04 kg/kWh lifecycle
            baseFactor: 0.008,
            isSharedByOccupancy: true,
            label: "☀️ Electric Vehicle (Solar / Clean Charged)",
            tip: "Charged via rooftop solar or green power tariff. Near-zero lifecycle carbon intensity!"
        },
        motorbike: {
            baseFactor: 0.103,
            isSharedByOccupancy: true,
            label: "🏍️ Motorcycle / Scooter (Petrol)",
            tip: "Fuel-efficient, but emits more per passenger-km than shared public transit or electric 2-wheelers."
        },
        electric_scooter: {
            // E-Scooter: ~0.03 kWh/km * 0.8774 kg/kWh
            baseFactor: 0.026,
            isSharedByOccupancy: true,
            label: "🛵 Electric Scooter / E-Bike (Grid)",
            tip: "Highly efficient lightweight urban transit. Consumes only ~0.03 kWh per km."
        },
        electric_scooter_solar: {
            baseFactor: 0.003,
            isSharedByOccupancy: true,
            label: "☀️ Electric Scooter (Solar Charged)",
            tip: "Near-zero charging emissions when powered by rooftop solar generation."
        },
        auto_rickshaw: {
            baseFactor: 0.055,
            isSharedByOccupancy: false, // Measured per passenger-km
            label: "🛺 Auto-Rickshaw / 3-Wheeler (CNG/EV)",
            tip: "Shared three-wheelers provide low-carbon urban last-mile connectivity."
        },
        bus: {
            baseFactor: 0.089,
            isSharedByOccupancy: false,
            label: "🚌 Public Bus",
            tip: "Municipal bus transit is ~50% cleaner than driving solo."
        },
        train: {
            baseFactor: 0.035,
            isSharedByOccupancy: false,
            label: "🚄 Train / Metro Rail",
            tip: "Electric commuter trains are among the lowest-carbon transport modes in the world."
        },
        bike: {
            baseFactor: 0.005,
            isSharedByOccupancy: false,
            label: "🚴 Bicycle",
            tip: "Near-zero lifecycle emissions. The gold standard for city trips."
        },
        walking: {
            baseFactor: 0.0,
            isSharedByOccupancy: false,
            label: "🚶 Walking",
            tip: "Zero emission mobility with outstanding health and climate benefits."
        }
    },

    // Commute Frequencies (eliminates 365-day calendar commute inflation)
    transportFrequencies: {
        "5_days": { daysPerYear: 240, label: "5 days/wk (Office / College Commute)" },
        "7_days": { daysPerYear: 365, label: "7 days/wk (Daily Travel)" },
        "3_days": { daysPerYear: 144, label: "3 days/wk (Hybrid / Part-Time)" },
        "1_day":  { daysPerYear: 52,  label: "1-2 days/wk (Occasional / Weekend)" }
    },

    // Electricity & Household Energy Sources
    electricity: {
        grid: {
            factor: 0.82 * 1.07, // 0.8774 kg CO2e/kWh (national average grid intensity + 7% T&D loss)
            label: "⚡ Grid Electricity (standard tariff)",
            unit: "kWh",
            isSolar: false
        },
        green_grid: {
            factor: 0.15,
            label: "🌱 Certified Renewable / Green Tariff",
            unit: "kWh",
            isSolar: false
        },
        solar_rooftop: {
            factor: 0.04, // Embodied lifecycle panel manufacturing footprint
            label: "☀️ Rooftop Solar PV Generation",
            unit: "kWh",
            isSolar: true
        },
        lpg_cylinder: {
            // 1 standard 14.2 kg LPG cylinder = 42.36 kg CO2e
            factor: 42.36,
            label: "🔥 LPG Cooking Cylinders (14.2 kg cyl)",
            unit: "cylinders",
            isSolar: false
        },
        diesel_generator: {
            // 1 litre of diesel = 2.68 kg CO2e
            factor: 2.68,
            label: "🛢️ Backup Generator Diesel",
            unit: "Litres",
            isSolar: false
        }
    },

    // Avoided Grid Displacement Benefit per kWh of solar generated:
    // (0.8774 kg CO2e grid displaced - 0.04 kg CO2e solar embodied lifecycle)
    solarDisplacementBenefit: (0.82 * 1.07) - 0.04,

    // Food & Nutrition (kg CO₂e/day for typical adult intake ~2100-2400 kcal)
    food: {
        vegan: {
            dailyFactor: 1.40,
            label: "🌱 Vegan (100% Plant-Based)"
        },
        vegetarian_low_dairy: {
            dailyFactor: 1.95,
            label: "🥗 Lacto-Vegetarian (Low Dairy - Tea/coffee milk only)"
        },
        vegetarian_high_dairy: {
            dailyFactor: 2.85,
            label: "🧀 Lacto-Vegetarian (High Dairy - Daily Paneer, Ghee, Curd)"
        },
        pescatarian: {
            dailyFactor: 2.40,
            label: "🐟 Pescatarian (Fish & Seafood + Veg)"
        },
        omnivore_medium: {
            dailyFactor: 3.30,
            label: "🍗 Moderate Omnivore (Poultry/Eggs 2–3x/week)"
        },
        omnivore_heavy: {
            dailyFactor: 5.20,
            label: "🥩 Heavy Meat Consumer (Daily Meat, Mutton/Beef)"
        }
    },

    // Solid Waste Streams (kg CO₂e per kg of municipal solid waste)
    waste: {
        mixed: {
            factor: 0.45,
            recycledFactor: 0.12,
            label: "🗑️ Unsorted Municipal Waste"
        },
        organic_food: {
            factor: 0.60,
            recycledFactor: 0.08, // Aerobically composted
            label: "🍏 Food & Organic Kitchen Scraps"
        },
        plastic: {
            factor: 1.80,
            recycledFactor: 0.40,
            label: "🧴 Plastic Packaging & Containers"
        },
        paper_cardboard: {
            factor: 0.90,
            recycledFactor: 0.20,
            label: "📦 Paper, Books & Cardboard"
        }
    },

    // Air Travel: Take-Off & Landing (LTO) penalty + high-altitude cruising
    flights: {
        economy_domestic: {
            ltoPenalty: 60,   // kg CO2e per passenger takeoff & climb cycle
            cruiseFactor: 85, // kg CO2e per cruising hour (DEFRA / IPCC with RFI x1.9)
            label: "✈️ Economy Short-Haul / Domestic (< 3 hrs)"
        },
        economy_longhaul: {
            ltoPenalty: 75,
            cruiseFactor: 95,
            label: "🌐 Economy Long-Haul (> 3 hrs)"
        },
        business_first: {
            ltoPenalty: 140,  // larger seat footprint & service weight multiplier
            cruiseFactor: 190,
            label: "🥂 Business / First Class Flight"
        }
    },

    // Offsetting & Equivalences:
    offset: {
        kgCo2PerTreePerYear: 21.77, // Mature native tree absorbs ~21.8 kg CO2/year upon maturity (EPA)
        get kgCo2PerTreePerDay() {
            return this.kgCo2PerTreePerYear / 365;
        },
        kmCarPerKgCo2: 1 / 0.171
    },

    // Annualized per-capita thresholds (metric tonnes CO₂e/year)
    benchmarks: {
        indiaAvgAnnual: 1.90,        // India national per-capita average (~1.9 t/yr)
        parisTargetAnnual: 2.00,     // Paris Agreement 1.5°C target limit (~2.0 t/yr)
        worldAvgAnnual: 4.50,        // Global per-capita average (~4.5 t/yr)
        usAvgAnnual: 14.60           // High-income North American average (~14.6 t/yr)
    }
};

// ============================================================================
// 2. DYNAMIC ROW MANAGER
// ============================================================================
class RowManager {

    /**
     * Transportation Row (with commute frequency, distance & occupancy)
     */
    static createTransportRow(data = {}) {
        const row = document.createElement("div");
        row.className = "dynamic-row transport-item-row";

        const options = Object.entries(CARBON_METRICS.transport)
            .map(([key, val]) => `<option value="${key}" ${data.mode === key ? "selected" : ""}>${val.label}</option>`)
            .join("");

        const freqOptions = Object.entries(CARBON_METRICS.transportFrequencies)
            .map(([key, val]) => {
                const isSel = data.frequency === key || (!data.frequency && key === "5_days");
                return `<option value="${key}" ${isSel ? "selected" : ""}>${val.label}</option>`;
            })
            .join("");

        const occVal = data.occupancy !== undefined ? data.occupancy : "1";

        row.innerHTML = `
            <div class="dynamic-row-field">
                <label>Mode of Travel</label>
                <select class="transport-mode" required>
                    <option value="">Select Mode</option>
                    ${options}
                </select>
            </div>
            <div class="dynamic-row-field">
                <label>Distance / Trip (km)</label>
                <input type="number" class="transport-km" min="0" step="any" placeholder="e.g. 20" value="${data.km !== undefined ? data.km : ""}" required>
            </div>
            <div class="dynamic-row-field">
                <label>Commute Frequency</label>
                <select class="transport-frequency" required>
                    ${freqOptions}
                </select>
            </div>
            <div class="dynamic-row-field">
                <label>Occupants</label>
                <input type="number" class="transport-occupancy" min="1" max="10" step="1" placeholder="1" value="${occVal}" title="Passengers sharing vehicle (default 1 for solo driving)">
            </div>
            <button type="button" class="remove-row-btn" title="Remove this leg">✖ Remove</button>
        `;

        row.querySelector(".remove-row-btn").addEventListener("click", () => {
            RowManager.removeRow("transportRows", row);
        });

        return row;
    }

    /**
     * Electricity / Household Energy Row (with Monthly vs Daily Billing Cycle)
     */
    static createElectricityRow(data = {}) {
        const row = document.createElement("div");
        row.className = "dynamic-row electricity-item-row";

        const options = Object.entries(CARBON_METRICS.electricity)
            .map(([key, val]) => `<option value="${key}" ${data.source === key ? "selected" : ""}>${val.label}</option>`)
            .join("");

        const cycleOptions = `
            <option value="monthly" ${data.cycle !== "daily" ? "selected" : ""}>Monthly Bill (Per Month)</option>
            <option value="daily" ${data.cycle === "daily" ? "selected" : ""}>Daily Average (Per Day)</option>
        `;

        row.innerHTML = `
            <div class="dynamic-row-field">
                <label>Energy Source / System</label>
                <select class="electricity-source" required>
                    ${options}
                </select>
            </div>
            <div class="dynamic-row-field">
                <label>Household Amount (see unit)</label>
                <input type="number" class="electricity-kwh" min="0" step="any" placeholder="e.g. 150" value="${data.kwh !== undefined ? data.kwh : ""}" required>
            </div>
            <div class="dynamic-row-field">
                <label>Billing / Usage Cycle</label>
                <select class="electricity-cycle" required>
                    ${cycleOptions}
                </select>
            </div>
            <button type="button" class="remove-row-btn" title="Remove source">✖ Remove</button>
        `;

        row.querySelector(".remove-row-btn").addEventListener("click", () => {
            RowManager.removeRow("electricityRows", row);
        });

        return row;
    }

    /**
     * Food / Diet Row (with high-dairy vs low-dairy vs vegan options)
     */
    static createFoodRow(data = {}) {
        const row = document.createElement("div");
        row.className = "dynamic-row food-item-row";

        // Backward compatibility mapping for old stored keys
        let selectedDiet = data.diet;
        if (selectedDiet === "vegetarian") selectedDiet = "vegetarian_low_dairy";
        if (selectedDiet === "omnivore_average") selectedDiet = "omnivore_medium";

        const options = Object.entries(CARBON_METRICS.food)
            .map(([key, val]) => `<option value="${key}" ${selectedDiet === key ? "selected" : ""}>${val.label}</option>`)
            .join("");

        row.innerHTML = `
            <div class="dynamic-row-field">
                <label>Diet Pattern</label>
                <select class="food-diet" required>
                    <option value="">Select Diet</option>
                    ${options}
                </select>
            </div>
            <div class="dynamic-row-field">
                <label>Meals Per Day</label>
                <input type="number" class="food-meals" min="0.5" max="10" step="any" placeholder="Default: 3" value="${data.meals !== undefined ? data.meals : "3"}" required>
            </div>
            <button type="button" class="remove-row-btn" title="Remove meal type">✖ Remove</button>
        `;

        row.querySelector(".remove-row-btn").addEventListener("click", () => {
            RowManager.removeRow("foodRows", row);
        });

        return row;
    }

    /**
     * Waste Stream Row
     */
    static createWasteRow(data = {}) {
        const row = document.createElement("div");
        row.className = "dynamic-row waste-row waste-item-row";

        const options = Object.entries(CARBON_METRICS.waste)
            .map(([key, val]) => `<option value="${key}" ${data.stream === key ? "selected" : ""}>${val.label}</option>`)
            .join("");

        row.innerHTML = `
            <div class="dynamic-row-field">
                <label>Waste Stream</label>
                <select class="waste-stream" required>
                    ${options}
                </select>
            </div>
            <div class="dynamic-row-field">
                <label>Weekly Household Amount (kg)</label>
                <input type="number" class="waste-kg" min="0" step="any" placeholder="e.g. 3" value="${data.kg !== undefined ? data.kg : ""}" required>
            </div>
            <div class="recycle-toggle">
                <input type="checkbox" class="waste-recycle" ${data.recycles ? "checked" : ""}>
                <label class="recycle-label">Recycled / Composted</label>
            </div>
            <button type="button" class="remove-row-btn" title="Remove waste stream">✖ Remove</button>
        `;

        row.querySelector(".remove-row-btn").addEventListener("click", () => {
            RowManager.removeRow("wasteRows", row);
        });

        return row;
    }

    /**
     * Air Travel Row (with flights taken & annual flight hours)
     */
    static createFlightRow(data = {}) {
        const row = document.createElement("div");
        row.className = "dynamic-row flight-item-row";

        const options = Object.entries(CARBON_METRICS.flights)
            .map(([key, val]) => `<option value="${key}" ${data.type === key ? "selected" : ""}>${val.label}</option>`)
            .join("");

        const tripsVal = data.trips !== undefined ? data.trips : "0";
        const hoursVal = data.hours !== undefined ? data.hours : "0";

        row.innerHTML = `
            <div class="dynamic-row-field">
                <label>Flight Class</label>
                <select class="flight-type" required>
                    ${options}
                </select>
            </div>
            <div class="dynamic-row-field">
                <label>Flights Taken (Trips/Year)</label>
                <input type="number" class="flight-trips" min="0" step="1" placeholder="e.g. 2 (0 if none)" value="${tripsVal}" required title="Number of one-way or return legs taken per year">
            </div>
            <div class="dynamic-row-field">
                <label>Total Flight Hours (Per Year)</label>
                <input type="number" class="flight-hours" min="0" step="any" placeholder="e.g. 4 (0 if none)" value="${hoursVal}" required title="Total airborne hours flown across the entire year">
            </div>
            <button type="button" class="remove-row-btn" title="Remove flight">✖ Remove</button>
        `;

        row.querySelector(".remove-row-btn").addEventListener("click", () => {
            RowManager.removeRow("flightRows", row);
        });

        return row;
    }

    /**
     * Safely remove a row while ensuring at least 1 row remains
     */
    static removeRow(containerId, rowElement) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const count = container.querySelectorAll(".dynamic-row").length;
        if (count <= 1) {
            rowElement.querySelectorAll("input").forEach((inp) => {
                if (inp.type === "checkbox") inp.checked = false;
                else if (inp.type === "number") inp.value = "";
            });
            return;
        }

        rowElement.remove();
        RowManager.updateRemoveButtonsState(containerId);
    }

    static updateRemoveButtonsState(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const rows = container.querySelectorAll(".dynamic-row");
        const isOnlyOne = rows.length <= 1;

        rows.forEach((r) => {
            const btn = r.querySelector(".remove-row-btn");
            if (btn) {
                btn.disabled = isOnlyOne;
                btn.title = isOnlyOne ? "At least one row required" : "Remove this entry";
            }
        });
    }

    static initAllDefaultRows() {
        const ensureRow = (containerId, creatorFn, defaultData) => {
            const container = document.getElementById(containerId);
            if (!container) return;
            if (container.querySelectorAll(".dynamic-row").length === 0) {
                container.appendChild(creatorFn(defaultData));
            }
            RowManager.updateRemoveButtonsState(containerId);
        };

        ensureRow("transportRows", RowManager.createTransportRow, { mode: "car", km: 20, frequency: "5_days", occupancy: 1 });
        ensureRow("electricityRows", RowManager.createElectricityRow, { source: "grid", kwh: 150, cycle: "monthly" });
        ensureRow("foodRows", RowManager.createFoodRow, { diet: "vegetarian_low_dairy", meals: 3 });
        ensureRow("wasteRows", RowManager.createWasteRow, { stream: "mixed", kg: 3, recycles: false });
        ensureRow("flightRows", RowManager.createFlightRow, { type: "economy_domestic", trips: 0, hours: 0 });
    }
}

// ============================================================================
// 3. INPUT VALIDATOR
// ============================================================================
class InputValidator {
    static validate(payload) {
        const errors = [];

        // 1. Validate Household Size
        if (isNaN(payload.householdSize) || payload.householdSize < 1 || payload.householdSize > 50) {
            errors.push("Household Profile: Please enter a valid household size between 1 and 50.");
        }

        // 2. Validate Transport
        if (!payload.transports || payload.transports.length === 0) {
            errors.push("Please add at least one transportation mode.");
        } else {
            payload.transports.forEach((t, i) => {
                const legNum = i + 1;
                if (!t.mode) {
                    errors.push(`Transportation leg #${legNum}: Please select a mode of travel.`);
                }
                const hasKm = (t.rawKm !== undefined && t.rawKm !== null && t.rawKm !== "") || (!isNaN(t.km) && t.km !== null);
                if (!hasKm) {
                    errors.push(`Transportation leg #${legNum}: Please enter the distance travelled.`);
                } else if (isNaN(t.km) || t.km < 0) {
                    errors.push(`Transportation leg #${legNum}: Distance cannot be negative.`);
                }
                const occ = t.occupancy !== undefined ? t.occupancy : 1;
                if (occ < 1 || occ > 15) {
                    errors.push(`Transportation leg #${legNum}: Occupants must be between 1 and 15.`);
                }
            });
        }

        // 3. Validate Electricity
        if (payload.electricities) {
            payload.electricities.forEach((e, i) => {
                const srcNum = i + 1;
                if (!e.source) {
                    errors.push(`Electricity source #${srcNum}: Please select an energy source.`);
                }
                const hasKwh = (e.rawKwh !== undefined && e.rawKwh !== null && e.rawKwh !== "") || (!isNaN(e.kwh) && e.kwh !== null);
                if (!hasKwh) {
                    errors.push(`Electricity source #${srcNum}: Please enter consumption or generation.`);
                } else if (isNaN(e.kwh) || e.kwh < 0) {
                    errors.push(`Electricity source #${srcNum}: Value cannot be negative.`);
                }
            });
        }

        // 4. Validate Food
        if (!payload.foods || payload.foods.length === 0) {
            errors.push("Please add at least one diet/meal entry.");
        } else {
            payload.foods.forEach((f, i) => {
                const mealNum = i + 1;
                if (!f.diet) {
                    errors.push(`Food entry #${mealNum}: Please select a diet type.`);
                }
                const hasMeals = (f.rawMeals !== undefined && f.rawMeals !== null && f.rawMeals !== "") || (!isNaN(f.meals) && f.meals !== null);
                if (!hasMeals) {
                    errors.push(`Food entry #${mealNum}: Please specify meals per day.`);
                } else if (isNaN(f.meals) || f.meals <= 0) {
                    errors.push(`Food entry #${mealNum}: Meals per day must be greater than 0.`);
                } else if (f.meals > 10) {
                    errors.push(`Food entry #${mealNum}: Meals per day cannot exceed 10.`);
                }
            });
        }

        // 5. Validate Waste
        if (payload.wastes) {
            payload.wastes.forEach((w, i) => {
                const wasteNum = i + 1;
                if (!w.stream) {
                    errors.push(`Waste stream #${wasteNum}: Please select a waste type.`);
                }
                const hasKg = (w.rawKg !== undefined && w.rawKg !== null && w.rawKg !== "") || (!isNaN(w.kg) && w.kg !== null);
                if (!hasKg) {
                    errors.push(`Waste stream #${wasteNum}: Please enter weekly waste generation.`);
                } else if (isNaN(w.kg) || w.kg < 0) {
                    errors.push(`Waste stream #${wasteNum}: Waste amount cannot be negative.`);
                }
            });
        }

        // 6. Validate Flights
        if (payload.flights) {
            payload.flights.forEach((fl, i) => {
                const flightNum = i + 1;
                const hasHours = (fl.rawHours !== undefined && fl.rawHours !== null && fl.rawHours !== "") || (!isNaN(fl.hours) && fl.hours !== null);
                const hasTrips = (fl.rawTrips !== undefined && fl.rawTrips !== null && fl.rawTrips !== "") || (!isNaN(fl.trips) && fl.trips !== null);

                if (!hasHours && !hasTrips) {
                    errors.push(`Flight entry #${flightNum}: Please enter annual flight hours and trips (enter 0 if none).`);
                } else {
                    if (isNaN(fl.hours) || fl.hours < 0) {
                        errors.push(`Flight entry #${flightNum}: Flight hours cannot be negative.`);
                    }
                    if (isNaN(fl.trips) || fl.trips < 0) {
                        errors.push(`Flight entry #${flightNum}: Trips count cannot be negative.`);
                    }
                }
            });
        }

        return { valid: errors.length === 0, errors };
    }
}

// ============================================================================
// 4. MULTI-SOURCE SCIENTIFIC CARBON CALCULATOR
// ============================================================================
class CarbonCalculator {

    static calculate(payload) {
        const householdSize = Math.max(1, parseInt(payload.householdSize) || 1);

        // --------------------------------------------------------------------
        // 1. Transportation: Commute Frequency Weighting & Carpooling Divisor
        // --------------------------------------------------------------------
        let transportAnnualKg = 0;
        const transportDetails = [];

        (payload.transports || []).forEach((t) => {
            const km = Math.max(0, parseFloat(t.km) || 0);
            const conf = CARBON_METRICS.transport[t.mode] || CARBON_METRICS.transport.car;
            const occupancy = Math.max(1, parseInt(t.occupancy) || 1);
            const freqKey = t.frequency || "5_days";
            const freqConf = CARBON_METRICS.transportFrequencies[freqKey] || CARBON_METRICS.transportFrequencies["5_days"];
            const daysPerYear = freqConf.daysPerYear;

            // Carpool factor: divide vehicle emissions by passengers for private vehicles
            const effectiveFactor = (conf.isSharedByOccupancy && occupancy > 1)
                ? (conf.baseFactor / occupancy)
                : conf.baseFactor;

            // Annualized leg emissions: km/day * effectiveFactor * commute days/year
            const annualLegKg = km * effectiveFactor * daysPerYear;
            transportAnnualKg += annualLegKg;

            if (km > 0) {
                const carpoolText = (conf.isSharedByOccupancy && occupancy > 1) ? ` (${occupancy} occupants)` : "";
                transportDetails.push(`${km.toFixed(1)} km · ${conf.label} [${freqConf.label}]${carpoolText}`);
            }
        });

        // Smoothed daily transport emission (Annual / 365)
        const transportEmission = transportAnnualKg / 365;

        // --------------------------------------------------------------------
        // 2. Household Energy: Monthly Billing Cycles & Solar Net-Metering Offsets
        // --------------------------------------------------------------------
        let fossilAnnualKg = 0;
        let solarGenerationAnnualKwh = 0;
        const electricityDetails = [];

        (payload.electricities || []).forEach((e) => {
            const rawVal = Math.max(0, parseFloat(e.kwh) || 0);
            const conf = CARBON_METRICS.electricity[e.source] || CARBON_METRICS.electricity.grid;
            const cycle = e.cycle || "monthly";

            // Normalise to annual usage:
            // If entered as monthly bill: monthly * 12
            // If entered as daily: daily * 365
            const annualUsage = cycle === "monthly" ? rawVal * 12 : rawVal * 365;

            if (conf.isSolar) {
                solarGenerationAnnualKwh += annualUsage;
                if (rawVal > 0) {
                    electricityDetails.push(`☀️ ${rawVal.toFixed(1)} kWh (${cycle}) ${conf.label}`);
                }
            } else {
                const sourceAnnualEmission = annualUsage * conf.factor;
                fossilAnnualKg += sourceAnnualEmission;
                if (rawVal > 0) {
                    electricityDetails.push(`${rawVal.toFixed(1)} ${conf.unit} (${cycle}) · ${conf.label}`);
                }
            }
        });

        // Calculate Solar Net-Metering grid displacement credit (0.8374 kg CO2e / kWh)
        const solarDisplacementAnnualKg = solarGenerationAnnualKwh * CARBON_METRICS.solarDisplacementBenefit;
        const netHouseholdEnergyAnnualKg = Math.max(0, fossilAnnualKg - solarDisplacementAnnualKg);

        // Daily per-capita energy emission:
        const electricityEmission = (netHouseholdEnergyAnnualKg / 365) / householdSize;

        if (solarGenerationAnnualKwh > 0) {
            const savedDaily = (solarDisplacementAnnualKg / 365 / householdSize).toFixed(2);
            electricityDetails.push(`[☀️ Solar Net-Metering Credit: ~${savedDaily} kg CO₂e grid emissions avoided/day per person]`);
        }
        if (householdSize > 1 && electricityDetails.length > 0) {
            electricityDetails.push(`[Shared domestic energy divided by ${householdSize} household members]`);
        }

        // --------------------------------------------------------------------
        // 3. Food: High-Dairy / Vegan Proportional Caloric Weighting
        // --------------------------------------------------------------------
        let foodEmission = 0;
        const foodDetails = [];
        const totalMeals = (payload.foods || []).reduce((sum, f) => sum + (parseFloat(f.meals) || 0), 0);

        if (totalMeals > 0) {
            (payload.foods || []).forEach((f) => {
                const meals = Math.max(0, parseFloat(f.meals) || 0);

                // Backward-compat mapping
                let dietKey = f.diet;
                if (dietKey === "vegetarian") dietKey = "vegetarian_low_dairy";
                if (dietKey === "omnivore_average") dietKey = "omnivore_medium";

                const conf = CARBON_METRICS.food[dietKey] || CARBON_METRICS.food.vegetarian_low_dairy;

                // Proportion of diet represented by this meal type:
                const dietProportion = meals / totalMeals;
                // Realistic daily caloric intake scaling relative to standard 3 meals:
                const dailyIntakeScale = Math.min(1.5, Math.max(0.5, totalMeals / 3));

                const itemEmission = dietProportion * conf.dailyFactor * dailyIntakeScale;
                foodEmission += itemEmission;

                const pct = Math.round(dietProportion * 100);
                foodDetails.push(`${conf.label} (${meals} meals/day · ${pct}% of diet)`);
            });
        }

        // --------------------------------------------------------------------
        // 4. Waste: Weekly Household Generation Divided by Household Size (N)
        // --------------------------------------------------------------------
        let totalHouseholdWasteDaily = 0;
        const wasteDetails = [];
        (payload.wastes || []).forEach((w) => {
            const weeklyKg = Math.max(0, parseFloat(w.kg) || 0);
            const dailyKg = weeklyKg / 7;
            const conf = CARBON_METRICS.waste[w.stream] || CARBON_METRICS.waste.mixed;
            const factor = w.recycles ? conf.recycledFactor : conf.factor;
            const streamEmission = dailyKg * factor;
            totalHouseholdWasteDaily += streamEmission;
            if (weeklyKg > 0) {
                wasteDetails.push(`${weeklyKg.toFixed(1)} kg/wk (${conf.label}${w.recycles ? " - Recycled/Composted" : ""})`);
            }
        });
        const wasteEmission = totalHouseholdWasteDaily / householdSize;
        if (householdSize > 1 && wasteDetails.length > 0) {
            wasteDetails.push(`[Solid waste divided by ${householdSize} household members]`);
        }

        // --------------------------------------------------------------------
        // 5. Air Travel: Take-Off (LTO) Penalty + Cruising Hours
        // --------------------------------------------------------------------
        let flightAnnualKg = 0;
        const flightDetails = [];
        (payload.flights || []).forEach((fl) => {
            const hours = Math.max(0, parseFloat(fl.hours) || 0);
            // Default trips to 1 if hours > 0 but trips is 0
            const trips = Math.max(0, parseInt(fl.trips) || (hours > 0 ? Math.max(1, Math.round(hours / 2.5)) : 0));
            const conf = CARBON_METRICS.flights[fl.type] || CARBON_METRICS.flights.economy_domestic;

            if (hours > 0 || trips > 0) {
                const legAnnualEmission = (trips * conf.ltoPenalty) + (hours * conf.cruiseFactor);
                flightAnnualKg += legAnnualEmission;
                flightDetails.push(`${trips} flight(s) · ${hours.toFixed(1)} hrs/yr (${conf.label})`);
            }
        });
        const flightEmission = flightAnnualKg / 365;

        // --------------------------------------------------------------------
        // 6. Aggregate Totals & Breakdown
        // --------------------------------------------------------------------
        const totalEmission = transportEmission + electricityEmission + foodEmission + wasteEmission + flightEmission;

        const pct = (val) => (totalEmission > 0 ? (val / totalEmission) * 100 : 0);

        const breakdown = {
            transportation: {
                value: transportEmission,
                percentage: pct(transportEmission),
                details: transportDetails.length > 0 ? transportDetails.join(" • ") : "No commute logged"
            },
            electricity: {
                value: electricityEmission,
                percentage: pct(electricityEmission),
                details: electricityDetails.length > 0 ? electricityDetails.join(" • ") : "0 energy logged"
            },
            food: {
                value: foodEmission,
                percentage: pct(foodEmission),
                details: foodDetails.join(" • ")
            },
            waste: {
                value: wasteEmission,
                percentage: pct(wasteEmission),
                details: wasteDetails.length > 0 ? wasteDetails.join(" • ") : "0 kg waste"
            },
            flights: {
                value: flightEmission,
                percentage: pct(flightEmission),
                details: flightDetails.length > 0 ? flightDetails.join(" • ") : "No flights logged"
            }
        };

        // Dominant sector
        const dominant = Object.entries(breakdown).reduce(
            (max, [cat, data]) => (data.value > max.value ? { category: cat, value: data.value } : max),
            { category: "none", value: -1 }
        );

        // Annual projections
        const annualKg = totalEmission * 365;
        const annualTonnes = annualKg / 1000;

        // Offsetting calculations (mature tree equivalents over 20-year lifetime)
        const treesAnnual = annualKg > 0 ? Math.ceil(annualKg / CARBON_METRICS.offset.kgCo2PerTreePerYear) : 0;
        const carKmEquiv = (totalEmission * CARBON_METRICS.offset.kmCarPerKgCo2).toFixed(1);

        // Climate Grade benchmarked on annualized tonnes
        const rating = this.evaluateClimateRating(annualTonnes);

        return {
            timestamp: new Date().toISOString(),
            rawInputs: payload,
            emissions: {
                transport: transportEmission,
                electricity: electricityEmission,
                food: foodEmission,
                waste: wasteEmission,
                flights: flightEmission,
                total: totalEmission
            },
            breakdown,
            dominantCategory: dominant.category,
            dominantValue: dominant.value,
            annualProjection: {
                totalKg: annualKg,
                totalTonnes: annualTonnes
            },
            offsetEquivalents: {
                treesAnnual,
                carKmEquivalent: carKmEquiv
            },
            rating
        };
    }

    /**
     * Climate Sustainability Grade benchmarked on annualized tonnes CO₂e/year
     */
    static evaluateClimateRating(annualTonnes) {
        const b = CARBON_METRICS.benchmarks;

        if (annualTonnes <= 0) {
            return {
                grade: "—", label: "No Activity", badgeColor: "#9e9e9e",
                summary: "Please enter your regular lifestyle data to calculate your carbon grade."
            };
        }
        if (annualTonnes <= b.indiaAvgAnnual) {
            return {
                grade: "A+", label: "Climate Champion (Paris 1.5°C Aligned)", badgeColor: "#2e7d32",
                summary: `Your annualized footprint (${annualTonnes.toFixed(2)} t CO₂e/year) strictly aligns with the Paris Agreement 1.5°C threshold limit and is below India's per-capita national average!`
            };
        }
        if (annualTonnes <= b.worldAvgAnnual) {
            return {
                grade: "B", label: "Moderate Impact", badgeColor: "#1976d2",
                summary: `Your annualized footprint (${annualTonnes.toFixed(2)} t CO₂e/year) is below the global average (${b.worldAvgAnnual} t/yr). Room exists for targeted lifestyle savings.`
            };
        }
        if (annualTonnes <= b.usAvgAnnual) {
            return {
                grade: "C", label: "Elevated Carbon Intensity", badgeColor: "#f57c00",
                summary: `Your annualized footprint (${annualTonnes.toFixed(2)} t CO₂e/year) exceeds the global average. Focusing on your primary emissions sector will make a major difference.`
            };
        }
        return {
            grade: "D", label: "High Climate Impact", badgeColor: "#d32f2f",
            summary: `Your annualized footprint (${annualTonnes.toFixed(2)} t CO₂e/year) significantly exceeds sustainable global thresholds. Immediate transition interventions recommended.`
        };
    }
}

// ============================================================================
// 5. RECOMMENDATIONS ENGINE
// ============================================================================
class RecommendationsEngine {
    static generateInsights(result) {
        const { dominantCategory, emissions, rawInputs, annualProjection, offsetEquivalents } = result;
        const tips = [];

        switch (dominantCategory) {
            case "transportation": {
                const save = (emissions.transport * 0.5).toFixed(2);
                tips.push({
                    icon: "🚗", title: "Transit Mode Shift & Carpooling", priority: "High",
                    category: "Transportation",
                    text: `Transportation is your primary footprint source (${emissions.transport.toFixed(2)} kg CO₂e/day). Carpooling with colleagues, shifting to an electric two-wheeler, or taking electric metro rail can save ~${save} kg CO₂e daily.`,
                    impactKg: save
                });
                break;
            }
            case "electricity": {
                const save = (emissions.electricity * 0.6).toFixed(2);
                tips.push({
                    icon: "⚡", title: "Rooftop Solar PV & Energy Efficiency", priority: "High",
                    category: "Electricity",
                    text: `Domestic energy accounts for ${emissions.electricity.toFixed(2)} kg CO₂e/day per person. Installing rooftop solar with net-metering displaces high-carbon coal grid power, eliminating up to ~${save} kg CO₂e daily.`,
                    impactKg: save
                });
                break;
            }
            case "food": {
                const save = (emissions.food * 0.4).toFixed(2);
                tips.push({
                    icon: "🍽️", title: "Plant-Rich Diet & Dairy Moderation", priority: "High",
                    category: "Food",
                    text: `Diet drives ${emissions.food.toFixed(2)} kg CO₂e/day. Substituting heavy daily dairy (paneer/ghee) with legumes, nuts, and plant-based protein 3–4 days weekly curbs cattle methane, saving ~${save} kg CO₂e daily.`,
                    impactKg: save
                });
                break;
            }
            case "waste": {
                const save = (emissions.waste * 0.5).toFixed(2);
                tips.push({
                    icon: "♻️", title: "Organic Composting & Segregation", priority: "High",
                    category: "Waste",
                    text: `Solid waste generation drives ${emissions.waste.toFixed(2)} kg CO₂e/day. Aerobic home composting of kitchen scraps eliminates landfill methane, saving ~${save} kg CO₂e daily.`,
                    impactKg: save
                });
                break;
            }
            case "flights": {
                const save = (emissions.flights * 0.5).toFixed(2);
                tips.push({
                    icon: "✈️", title: "Rail Substitution for Short-Haul Flights", priority: "High",
                    category: "Flights",
                    text: `Aviation accounts for ${emissions.flights.toFixed(2)} kg CO₂e/day. Because aircraft burn ~25% of their fuel during takeoff and climb, replacing short-haul flights under 500 km with express electric rail avoids heavy takeoff fuel spikes.`,
                    impactKg: save
                });
                break;
            }
        }

        // Secondary cross-category suggestions
        const totalKm = (rawInputs.transports || []).reduce((sum, t) => sum + (parseFloat(t.km) || 0), 0);
        if (totalKm > 10 && dominantCategory !== "transportation") {
            tips.push({
                icon: "🚴", title: "Active Micro-Mobility", priority: "Medium",
                category: "Transportation",
                text: "For city trips under 5 km, walking or cycling eliminates tailpipe greenhouse gases completely while improving health."
            });
        }

        // Offsetting action
        if (annualProjection.totalKg > 0) {
            tips.push({
                icon: "🌳", title: "Natural Carbon Sequestration", priority: "Long-Term",
                category: "Offsetting",
                text: `To neutralize your annual lifestyle emissions (${annualProjection.totalTonnes.toFixed(2)} t CO₂e/year), planting and nurturing approximately ${offsetEquivalents.treesAnnual} mature native tree equivalents (20-year lifetime absorption horizon at ~21.8 kg/year upon maturity) is required.`
            });
        }

        return tips;
    }
}

// ============================================================================
// 6. STORAGE & HISTORY MANAGER
// ============================================================================
class CarbonHistoryManager {
    static STORAGE_KEY = "carbonTrack_history_v5";
    static LATEST_KEY  = "carbonTrack_latest_v5";

    static saveEntry(result) {
        try {
            localStorage.setItem(this.LATEST_KEY, JSON.stringify(result));

            const history = this.getHistory();
            history.unshift(result);
            if (history.length > 25) history.pop();

            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
        } catch (e) {
            console.warn("Storage quota exceeded or unavailable:", e);
        }
    }

    static getLatest() {
        try {
            const raw = localStorage.getItem(this.LATEST_KEY) || localStorage.getItem("carbonTrack_latest_v4");
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    static getHistory() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY) || localStorage.getItem("carbonTrack_history_v4");
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    static clearAll() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            localStorage.removeItem(this.LATEST_KEY);
        } catch (e) {
            console.warn("Error clearing history:", e);
        }
    }
}

// ============================================================================
// 7. CHART MANAGER (Chart.js Wrapper)
// ============================================================================
class ChartManager {
    static instance = null;

    static render(emissions) {
        const canvas = document.getElementById("carbonChart");
        if (!canvas) return;

        if (typeof Chart === "undefined") {
            console.warn("Chart.js library is not loaded from CDN.");
            return;
        }

        const dataValues = [
            Number(emissions.transport.toFixed(2)),
            Number(emissions.electricity.toFixed(2)),
            Number(emissions.food.toFixed(2)),
            Number(emissions.waste.toFixed(2)),
            Number(emissions.flights.toFixed(2))
        ];

        const labels = ["Transportation", "Electricity", "Food & Diet", "Waste", "Air Travel"];
        const bgColors = ["#2e7d32", "#fbc02d", "#0288d1", "#7b1fa2", "#e64a19"];

        if (this.instance) {
            this.instance.data.datasets[0].data = dataValues;
            this.instance.update();
            return;
        }

        const ctx = canvas.getContext("2d");
        this.instance = new Chart(ctx, {
            type: "doughnut",
            data: {
                labels,
                datasets: [{
                    data: dataValues,
                    backgroundColor: bgColors,
                    borderWidth: 2,
                    borderColor: "#ffffff"
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: {
                            font: { family: "'Inter', sans-serif", size: 12 },
                            padding: 16
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                const val = ctx.raw || 0;
                                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                                return ` ${ctx.label}: ${val} kg CO₂e/day (${pct}%)`;
                            }
                        }
                    }
                },
                cutout: "62%"
            }
        });
    }

    static destroy() {
        if (this.instance) {
            this.instance.destroy();
            this.instance = null;
        }
    }
}

// ============================================================================
// 8. DATA COLLECTION
// ============================================================================
function collectFormData() {
    const householdSize = parseInt(document.getElementById("householdMembers")?.value) || 1;

    // 1. Collect Transport rows
    const transports = [];
    document.querySelectorAll("#transportRows .transport-item-row").forEach((row) => {
        const mode = row.querySelector(".transport-mode")?.value || "";
        const rawKm = row.querySelector(".transport-km")?.value?.trim() ?? "";
        const km = rawKm !== "" ? parseFloat(rawKm) : NaN;
        const frequency = row.querySelector(".transport-frequency")?.value || "5_days";
        const occupancy = parseInt(row.querySelector(".transport-occupancy")?.value) || 1;
        transports.push({ mode, rawKm, km, frequency, occupancy });
    });

    // 2. Collect Electricity rows
    const electricities = [];
    document.querySelectorAll("#electricityRows .electricity-item-row").forEach((row) => {
        const source = row.querySelector(".electricity-source")?.value || "";
        const rawKwh = row.querySelector(".electricity-kwh")?.value?.trim() ?? "";
        const kwh = rawKwh !== "" ? parseFloat(rawKwh) : NaN;
        const cycle = row.querySelector(".electricity-cycle")?.value || "monthly";
        electricities.push({ source, rawKwh, kwh, cycle });
    });

    // 3. Collect Food rows
    const foods = [];
    document.querySelectorAll("#foodRows .food-item-row").forEach((row) => {
        const diet = row.querySelector(".food-diet")?.value || "";
        const rawMeals = row.querySelector(".food-meals")?.value?.trim() ?? "";
        const meals = rawMeals !== "" ? parseFloat(rawMeals) : NaN;
        foods.push({ diet, rawMeals, meals });
    });

    // 4. Collect Waste rows
    const wastes = [];
    document.querySelectorAll("#wasteRows .waste-item-row").forEach((row) => {
        const stream = row.querySelector(".waste-stream")?.value || "";
        const rawKg = row.querySelector(".waste-kg")?.value?.trim() ?? "";
        const kg = rawKg !== "" ? parseFloat(rawKg) : NaN;
        const recycles = row.querySelector(".waste-recycle")?.checked || false;
        wastes.push({ stream, rawKg, kg, recycles });
    });

    // 5. Collect Flight rows
    const flights = [];
    document.querySelectorAll("#flightRows .flight-item-row").forEach((row) => {
        const type = row.querySelector(".flight-type")?.value || "";
        const rawTrips = row.querySelector(".flight-trips")?.value?.trim() ?? "";
        const trips = rawTrips !== "" ? parseInt(rawTrips) : 0;
        const rawHours = row.querySelector(".flight-hours")?.value?.trim() ?? "";
        const hours = rawHours !== "" ? parseFloat(rawHours) : NaN;
        flights.push({ type, rawTrips, trips, rawHours, hours });
    });

    return { householdSize, transports, electricities, foods, wastes, flights };
}

// ============================================================================
// 9. FORM SUBMISSION PIPELINE
// ============================================================================
const carbonForm = document.getElementById("carbonForm");

if (carbonForm) {
    carbonForm.addEventListener("submit", function (e) {
        e.preventDefault();
        clearValidationErrors();

        const payload = collectFormData();

        // Validate
        const validation = InputValidator.validate(payload);
        if (!validation.valid) {
            showValidationErrors(validation.errors);
            return;
        }

        // Calculate
        const result = CarbonCalculator.calculate(payload);

        // Save
        CarbonHistoryManager.saveEntry(result);

        // Render
        renderResults(result);

        // Reveal dashboard
        const dash = document.getElementById("dashboard");
        if (dash) {
            dash.style.display = "block";
            dash.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    });
}

// ============================================================================
// 10. RENDERING FUNCTIONS
// ============================================================================
function renderResults(result) {
    const { emissions, breakdown } = result;

    const set = (id, txt) => {
        const el = document.getElementById(id);
        if (el) el.textContent = txt;
    };

    set("totalEmission",     emissions.total.toFixed(2));
    set("transportResult",   emissions.transport.toFixed(2));
    set("electricityResult", emissions.electricity.toFixed(2));
    set("foodResult",        emissions.food.toFixed(2));
    set("wasteResult",       emissions.waste.toFixed(2));
    set("flightResult",      emissions.flights.toFixed(2));

    // Render detailed itemized breakdown under each category box
    set("transportDetails",   breakdown.transportation.details || "");
    set("electricityDetails", breakdown.electricity.details || "");
    set("foodDetails",        breakdown.food.details || "");
    set("wasteDetails",       breakdown.waste.details || "");
    set("flightDetails",      breakdown.flights.details || "");

    // Render Doughnut Chart
    ChartManager.render(emissions);

    // Render Insights & Breakdown
    const insights = RecommendationsEngine.generateInsights(result);
    renderInsights(insights, result.rating, result.annualProjection, result.offsetEquivalents, breakdown);
}

function renderInsights(insights, rating, annual, offset, breakdown) {
    const el = document.getElementById("suggestion");
    if (!el) return;

    const primary = insights[0]?.text || "Great job maintaining a minimal footprint!";

    let tipsHtml = "";
    if (insights.length > 1) {
        tipsHtml = '<div class="insight-tips">';
        for (let i = 1; i < insights.length; i++) {
            tipsHtml += `
                <div class="insight-tip-item">
                    <span class="insight-tip-icon">${insights[i].icon}</span>
                    <div>
                        <strong>${insights[i].title}</strong>
                        <span class="insight-tip-priority priority-${insights[i].priority.toLowerCase().replace(/[^a-z]/g, "")}">${insights[i].priority}</span>
                        <p>${insights[i].text}</p>
                    </div>
                </div>`;
        }
        tipsHtml += "</div>";
    }

    el.innerHTML = `
        <div class="rating-badge" data-grade="${rating.grade}" style="color: ${rating.badgeColor};">
            🏆 Annual Climate Grade: <strong>${rating.grade}</strong> — ${rating.label}
        </div>
        <p class="rating-summary">${rating.summary}</p>
        <div class="insight-primary">
            <strong>🎯 Top Priority Action:</strong> ${primary}
        </div>
        <div class="insight-stats">
            <div class="insight-stat">
                <span class="insight-stat-value">${annual.totalTonnes.toFixed(2)}</span>
                <span class="insight-stat-label">tonnes CO₂e/year</span>
            </div>
            <div class="insight-stat">
                <span class="insight-stat-value">~${offset.treesAnnual}</span>
                <span class="insight-stat-label">mature trees to offset (20-yr horizon)</span>
            </div>
            <div class="insight-stat">
                <span class="insight-stat-value">${offset.carKmEquivalent} km</span>
                <span class="insight-stat-label">gasoline car equivalent</span>
            </div>
        </div>
        ${tipsHtml}
    `;
}

// ============================================================================
// 11. VALIDATION ERROR DISPLAY
// ============================================================================
function showValidationErrors(errors) {
    const container = document.getElementById("validationErrors");
    if (!container) return;
    container.style.display = "block";
    container.innerHTML = errors.map((e) => `<p>⚠️ ${e}</p>`).join("");
    container.scrollIntoView({ behavior: "smooth", block: "center" });
}

function clearValidationErrors() {
    const container = document.getElementById("validationErrors");
    if (container) {
        container.style.display = "none";
        container.innerHTML = "";
    }
}

// ============================================================================
// 12. HISTORY DISPLAY MODAL / DRAWER
// ============================================================================
function renderHistory() {
    const history = CarbonHistoryManager.getHistory();
    const section = document.getElementById("historySection");
    const list = document.getElementById("historyList");
    if (!section || !list) return;

    if (history.length === 0) {
        list.innerHTML = '<p class="history-empty">No logged footprint records yet. Calculate above to start your history log!</p>';
    } else {
        list.innerHTML = history.map((entry) => {
            const date = new Date(entry.timestamp);
            const dateStr = date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
            const timeStr = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
            const grade = entry.rating?.grade || "B";
            const color = entry.rating?.badgeColor || "#2e7d32";
            const total = entry.emissions?.total?.toFixed(2) || "0.00";
            const tonnes = entry.annualProjection?.totalTonnes?.toFixed(2) || "0";

            return `
                <div class="history-entry">
                    <div class="history-entry-header">
                        <span class="history-entry-date">📅 ${dateStr} · ${timeStr}</span>
                        <span class="history-entry-grade" style="color: ${color};">${grade}</span>
                    </div>
                    <div class="history-entry-body">
                        <span><strong>${total}</strong> kg CO₂e/day</span>
                        <span class="history-entry-annual">${tonnes} t/year</span>
                    </div>
                </div>`;
        }).join("");
    }

    section.style.display = "block";
}

function clearHistory() {
    CarbonHistoryManager.clearAll();
    const list = document.getElementById("historyList");
    if (list) list.innerHTML = '<p class="history-empty">History cleared.</p>';
}

// ============================================================================
// 13. DOM INITIALIZATION & AUTO-RESTORE
// ============================================================================
document.addEventListener("DOMContentLoaded", () => {
    // 1. Wire "+ Add" Buttons
    const bindAddBtn = (btnId, containerId, createFn) => {
        const btn = document.getElementById(btnId);
        const container = document.getElementById(containerId);
        if (btn && container) {
            btn.addEventListener("click", () => {
                container.appendChild(createFn());
                RowManager.updateRemoveButtonsState(containerId);
            });
        }
    };

    bindAddBtn("addTransportBtn", "transportRows", RowManager.createTransportRow);
    bindAddBtn("addElectricityBtn", "electricityRows", RowManager.createElectricityRow);
    bindAddBtn("addFoodBtn", "foodRows", RowManager.createFoodRow);
    bindAddBtn("addWasteBtn", "wasteRows", RowManager.createWasteRow);
    bindAddBtn("addFlightBtn", "flightRows", RowManager.createFlightRow);

    // Auto-restore previous state if present
    const last = CarbonHistoryManager.getLatest();
    if (last && last.rawInputs) {
        const p = last.rawInputs;

        // Restore Household Size
        const hhInput = document.getElementById("householdMembers");
        if (hhInput && p.householdSize) {
            hhInput.value = p.householdSize;
        }

        // Restore Transports
        const tCont = document.getElementById("transportRows");
        if (tCont && p.transports && p.transports.length > 0) {
            tCont.innerHTML = "";
            p.transports.forEach((t) => tCont.appendChild(RowManager.createTransportRow(t)));
            RowManager.updateRemoveButtonsState("transportRows");
        }

        // Restore Electricities
        const eCont = document.getElementById("electricityRows");
        if (eCont && p.electricities && p.electricities.length > 0) {
            eCont.innerHTML = "";
            p.electricities.forEach((e) => eCont.appendChild(RowManager.createElectricityRow(e)));
            RowManager.updateRemoveButtonsState("electricityRows");
        }

        // Restore Foods
        const fCont = document.getElementById("foodRows");
        if (fCont && p.foods && p.foods.length > 0) {
            fCont.innerHTML = "";
            p.foods.forEach((f) => fCont.appendChild(RowManager.createFoodRow(f)));
            RowManager.updateRemoveButtonsState("foodRows");
        }

        // Restore Wastes
        const wCont = document.getElementById("wasteRows");
        if (wCont && p.wastes && p.wastes.length > 0) {
            wCont.innerHTML = "";
            p.wastes.forEach((w) => wCont.appendChild(RowManager.createWasteRow(w)));
            RowManager.updateRemoveButtonsState("wasteRows");
        }

        // Restore Flights
        const flCont = document.getElementById("flightRows");
        if (flCont && p.flights && p.flights.length > 0) {
            flCont.innerHTML = "";
            p.flights.forEach((fl) => flCont.appendChild(RowManager.createFlightRow(fl)));
            RowManager.updateRemoveButtonsState("flightRows");
        }

        renderResults(last);
        const dash = document.getElementById("dashboard");
        if (dash) dash.style.display = "block";
    } else {
        RowManager.initAllDefaultRows();
    }
});