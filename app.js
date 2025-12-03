// ============================================
// MAIN APPLICATION CLASS
// ============================================
class BatangasJeepneySystem {
    constructor() {
        this.map = null;
        this.routeLayers = {};
        this.activeRoutes = [];
        this.currentLocationMarker = null;
        this.userLocation = null;
        this.accuracyCircle = null;
        this.searchRadiusCircle = null;
        this.nearestRoutes = [];
        this.currentWalkingRoute = null;
        this.walkingStartMarker = null;
        this.walkingEndMarker = null;
        
        // Route boarding validation
        this.routeBoardingZones = this.initializeBoardingZones();
        this.invalidRouteCombinations = this.initializeInvalidCombinations();
    
        // Map click functionality
        this.mapClickEnabled = false;
        this.mapClickField = null;
        
        // Custom markers
        this.customStartMarker = null;
        this.customDestinationMarker = null;
        this.tempStartMarker = null;
        this.tempDestinationMarker = null;

        // Initialize
        this.init();
    }

    // ============================================
    // INITIALIZATION METHODS
    // ============================================
    init() {
        this.initializeMap();
        this.initializeEventListeners();
        this.initializeUI();
        console.log('Batangas Jeepney System initialized');
    }

    initializeMap() {
        const mapElement = document.getElementById('map');
        if (mapElement) {
            mapElement.style.height = '100vh';
            mapElement.style.width = '100%';
        }
        
        // Batangas City bounds
        const batangasBounds = L.latLngBounds(
            L.latLng(13.7200, 121.0200),
            L.latLng(13.8200, 121.1200)
        );

        // Initialize map
        this.map = L.map('map', {
            center: [13.7565, 121.0583],
            zoom: 15,
            minZoom: 15,
            maxZoom: 18,
            maxBounds: batangasBounds,
            maxBoundsViscosity: 1.0,
            worldCopyJump: false
        });
        
        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            noWrap: true,
            bounds: batangasBounds
        }).addTo(this.map);

        // Strict bounds enforcement
        this.map.on('drag', () => {
            this.map.panInsideBounds(batangasBounds, { animate: false });
        });

        this.map.on('moveend', () => {
            if (!batangasBounds.contains(this.map.getCenter())) {
                this.map.panTo([13.7565, 121.0583], { animate: true });
            }
        });

        // Initialize landmarks layer
        this.landmarksLayer = L.layerGroup().addTo(this.map);
        L.control.scale().addTo(this.map);

        // Map click listener
        this.map.on('click', (e) => {
            if (this.mapClickEnabled) {
                this.handleMapClick(e.latlng);
            }
        });

        this.showNotification('Loading...', 'info');
    }

    initializeEventListeners() {
        // Sidebar toggle
        document.getElementById('sidebarToggle').addEventListener('click', () => {
            this.toggleSidebar();
        });

        // Location input suggestions
        document.getElementById('startLocation').addEventListener('input', (e) => {
            this.showSuggestions(e.target.value, 'startSuggestions');
        });

        document.getElementById('endLocation').addEventListener('input', (e) => {
            this.showSuggestions(e.target.value, 'endSuggestions');
        });

        // Click outside to close suggestions
        document.addEventListener('click', (e) => {
            if (!e.target.matches('#startLocation') && !e.target.matches('#startSuggestions *')) {
                document.getElementById('startSuggestions').style.display = 'none';
            }
            if (!e.target.matches('#endLocation') && !e.target.matches('#endSuggestions *')) {
                document.getElementById('endSuggestions').style.display = 'none';
            }
        });

        // Discount toggle 
        const discountToggle = document.getElementById('discountToggle');
        if (discountToggle) {
            discountToggle.addEventListener('change', () => {
                this.updateAllDisplayedFares();
            });
        }
    }

    initializeUI() {
        this.populateRoutesList();
    }

    // ============================================
    // ROUTE BOARDING VALIDATION
    // ============================================
    initializeBoardingZones() {
        return {
            "Batangas - Alangilan": {
                primary: ["Batangas City Grand Terminal", "SM Hypermarket", "BatStateU-Alangilan"],
                secondary: ["Don Ramos", "UB/Hilltop", "Lawas", "Waltermart"],
                restricted: ["Sta. Clara Elementary School", "Pier/Port of Batangas"]
            },
            // ... (other routes - same as before)
        };
    }

    initializeInvalidCombinations() {
        return {
            "UB/Hilltop": ["Batangas - Sta. Clara/Pier", "Batangas - Libjo/San-Isidro/Tabangao"],
            "Sta. Clara Elementary School": ["Batangas - Alangilan", "Batangas - Balagtas", "Batangas - Lipa", "Batangas - Soro Soro", "Batangas - Balete", "Batangas - Bauan"],
            // ... (other restrictions - same as before)
        };
    }

    canBoardRouteFromLocation(locationName, routeName) {
        // "My Location" is always valid
        if (locationName.includes("My Location")) {
            return true;
        }

        // Check invalid combinations
        if (this.invalidRouteCombinations[locationName] && 
            this.invalidRouteCombinations[locationName].includes(routeName)) {
            return false;
        }

        // Check boarding zones
        const routeZones = this.routeBoardingZones[routeName];
        if (!routeZones) return true;

        if (routeZones.primary.includes(locationName) || 
            routeZones.secondary.includes(locationName)) {
            return true;
        }

        if (routeZones.restricted.includes(locationName)) {
            return false;
        }

        // Default: allow with warning
        return true;
    }

    // ============================================
    // UI METHODS
    // ============================================
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('collapsed');
    }

    populateRoutesList() {
        const routesList = document.getElementById('routes-list');
        routesList.innerHTML = '';
        
        Object.entries(jeepneyRoutes).forEach(([routeName, routeData]) => {
            const routeItem = document.createElement('div');
            routeItem.className = 'route-item';
            routeItem.setAttribute('data-route', routeName);
            routeItem.setAttribute('data-original-fare', routeData.fare); 
            
            routeItem.innerHTML = `
                <div style="font-weight: bold;">${routeName}</div>
                <div class="route-info">
                    Fare: ${this.formatFare(routeData.fare)}
                </div>
            `;
            
            routeItem.addEventListener('click', () => {
                routeManager.createSnappedRoute(routeName, routeData);
            });
            
            routesList.appendChild(routeItem);
        });
    }

    showSuggestions(query, suggestionsId) {
        const suggestionsList = document.getElementById(suggestionsId);
        
        if (query.length < 2) {
            suggestionsList.style.display = 'none';
            return;
        }

        const filteredStops = Object.keys(allStops).filter(stop =>
            stop.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 8);

        if (filteredStops.length === 0) {
            suggestionsList.style.display = 'none';
            return;
        }

        suggestionsList.innerHTML = filteredStops.map(stop => 
            `<div class="suggestion-item" onclick="app.selectSuggestion('${stop}', '${suggestionsId}')">${stop}</div>`
        ).join('');
        
        suggestionsList.style.display = 'block';
    }

    selectSuggestion(stopName, suggestionsId) {
        const field = suggestionsId === 'startSuggestions' ? 'startLocation' : 'endLocation';
        document.getElementById(field).value = stopName;
        document.getElementById(suggestionsId).style.display = 'none';
    }

    // ============================================
    // LOCATION METHODS
    // ============================================
    async useMyLocation(field, event) {
        if (!navigator.geolocation) {
            alert('❌ Geolocation is not supported by your browser');
            return;
        }

        const button = event?.target;
        const originalHTML = button.innerHTML;
        
        if (button) {
            button.innerHTML = '<span class="material-symbols-outlined btn-icon">my_location</span> Getting location...';
            button.disabled = true;
        }

        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 0
                });
            });

            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const accuracy = position.coords.accuracy;
            
            this.userLocation = [lat, lng];
            
            // Clear existing markers
            this.clearLocationMarkers();
            
            // Add accuracy circle
            const displayAccuracy = Math.min(accuracy, 500);
            this.accuracyCircle = L.circle([lat, lng], {
                radius: displayAccuracy,
                color: accuracy <= 50 ? '#00C851' : accuracy <= 100 ? '#ffbb33' : '#ff4444',
                fillColor: accuracy <= 50 ? '#00C851' : accuracy <= 100 ? '#ffbb33' : '#ff4444',
                fillOpacity: 0.2,
                weight: 2
            }).addTo(this.map);
            
            // Add location marker
            this.currentLocationMarker = L.marker([lat, lng], {
                icon: L.divIcon({
                    className: 'current-location-marker',
                    html: '📍',
                    iconSize: [30, 30],
                    iconAnchor: [15, 30]
                })
            })
            .addTo(this.map)
            .bindPopup(`
                <b>📍 Your Current Location</b><br>
                Accuracy: ${Math.round(accuracy)} meters<br>
                Coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)}
            `)
            .openPopup();
            
            // Center map
            this.map.flyTo([lat, lng], 16, { duration: 1 });
            
            // Set input field
            const inputField = field === 'start' ? 'startLocation' : 'endLocation';
            document.getElementById(inputField).value = `My Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
            
            // Find nearest routes if start location
            if (field === 'start') {
                await this.findNearestJeepneyRoutes([lat, lng]);
            }

        } catch (error) {
            console.error('Location error:', error);
            alert('❌ Could not get your location. Please ensure location services are enabled.');
        } finally {
            if (button) {
                button.innerHTML = `<span class="material-symbols-outlined btn-icon">my_location</span> Use My Location (${field === 'start' ? 'Start' : 'End'})`;
                button.disabled = false;
            }
        }
    }

    // Wrapper methods for location with/without routes
    async useMyLocationWithRoutes(field, event) {
        await this.useMyLocation(field, event);
    }

    async useMyLocationNoRoutes(field, event) {
        const originalFindNearestJeepneyRoutes = this.findNearestJeepneyRoutes;
        this.findNearestJeepneyRoutes = async () => {};
        
        try {
            await this.useMyLocation(field, event);
        } finally {
            this.findNearestJeepneyRoutes = originalFindNearestJeepneyRoutes;
        }
    }

    // ============================================
    // ROUTE FINDING METHODS
    // ============================================
    async findNearestJeepneyRoutes(userLocation) {
        console.log('Finding nearest jeepney routes...');
        
        const maxRadius = 2000;
        const radiusStep = 200;
        
        document.getElementById('loading').style.display = 'block';
        
        try {
            if (this.searchRadiusCircle) {
                this.map.removeLayer(this.searchRadiusCircle);
            }
            
            for (let radius = 100; radius <= maxRadius; radius += radiusStep) {
                if (this.searchRadiusCircle) {
                    this.map.removeLayer(this.searchRadiusCircle);
                }
                
                this.searchRadiusCircle = L.circle(userLocation, {
                    radius: radius,
                    color: '#2196f3',
                    fillColor: '#2196f3',
                    fillOpacity: 0.1,
                    weight: 2,
                    dashArray: '5, 5'
                }).addTo(this.map);
                
                const routesInRadius = this.findValidatedRoutesWithinRadius(userLocation, radius);
                
                if (routesInRadius.length > 0) {
                    this.displayNearestRoutes(routesInRadius, userLocation, radius);
                    break;
                }
                
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            
            if (this.nearestRoutes.length === 0) {
                this.showNotification('❌ No accessible jeepney routes found within 2km. Try a different location.', 'error');
            }
            
        } catch (error) {
            console.error('Error finding nearest routes:', error);
            this.showNotification('❌ Error searching for nearby routes', 'error');
        } finally {
            document.getElementById('loading').style.display = 'none';
        }
    }

    findValidatedRoutesWithinRadius(userLocation, radius) {
        const nearbyRoutes = [];
        
        Object.entries(jeepneyRoutes).forEach(([routeName, routeData]) => {
            const allRoutePoints = [...routeData.waypoints, ...(routeData.secretWaypoints || [])];
            
            let minDistance = Infinity;
            let closestPoint = null;
            
            allRoutePoints.forEach(point => {
                const distance = this.calculateDistance(userLocation, point);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestPoint = point;
                }
            });
            
            if (minDistance <= radius) {
                const nearestLandmark = this.findNearestLandmark(userLocation);
                const canBoard = !nearestLandmark || this.canBoardRouteFromLocation(nearestLandmark, routeName);
                
                nearbyRoutes.push({
                    routeName: routeName,
                    routeData: routeData,
                    distance: minDistance,
                    closestPoint: closestPoint,
                    recommendation: this.getTransportRecommendation(minDistance),
                    canBoard: canBoard,
                    boardingNote: canBoard ? '' : `Note: May require walking to boarding point`
                });
            }
        });
        
        // Sort by accessibility and distance
        return nearbyRoutes
            .sort((a, b) => {
                if (a.canBoard && !b.canBoard) return -1;
                if (!a.canBoard && b.canBoard) return 1;
                return a.distance - b.distance;
            })
            .slice(0, 5);
    }

    displayNearestRoutes(routes, userLocation, searchRadius) {
        this.nearestRoutes = routes;
        
        let html = `
            <h5>📍 Nearest Jeepney Routes (${routes.length} found within ${searchRadius}m)</h5>
            <div class="nearest-routes-list">
        `;
        
        routes.forEach((route, index) => {
            const rec = route.recommendation;
            const boardingClass = route.canBoard ? 'boarding-valid' : 'boarding-warning';
            
            html += `
                <div class="nearest-route-item ${boardingClass}">
                    <div class="route-header">
                        <strong>${index + 1}. ${route.routeName}</strong>
                        <span class="distance-badge">${Math.round(route.distance)}m away</span>
                    </div>
                    <div class="recommendation" style="background: ${rec.color}20; border-left: 4px solid ${rec.color}; padding: 8px; margin: 5px 0; border-radius: 4px;">
                        <strong>${rec.message}</strong>
                        <br>🕐 ${rec.time} min walking
                    </div>
                    ${!route.canBoard ? `<div class="boarding-warning-note">${route.boardingNote}</div>` : ''}
                    <div class="route-info">
                        Fare: ${this.formatFare(route.routeData.fare)}
                    </div>
                    <button class="control-btn success" onclick="routeManager.createSnappedRoute('${route.routeName}', jeepneyRoutes['${route.routeName}'])">
                        Show This Route
                    </button>
                    <button class="control-btn secondary" onclick="app.showWalkingRoute([${userLocation}], [${route.closestPoint}], ${route.distance})">
                        🚶 Show Walking Route
                    </button>
                </div>
            `;
        });
        
        html += `</div>`;
        
        document.getElementById('route-options').innerHTML = html;
        document.getElementById('route-options').style.display = 'block';
        
        this.showNotification(`✅ Found ${routes.length} jeepney routes nearby!`, 'success');
    }

    // ============================================
    // MAP CLICK FUNCTIONALITY
    // ============================================
    toggleMapClick(field) {
        this.mapClickField = field;
        this.mapClickEnabled = !this.mapClickEnabled;
        
        const startButton = document.getElementById('startMapClickToggle');
        const endButton = document.getElementById('endMapClickToggle');
        
        if (this.mapClickEnabled) {
            if (field === 'start') {
                startButton.innerHTML = '<span class="material-symbols-outlined btn-icon">cancel</span> Click to Cancel';
                startButton.style.background = '#ff9800';
                endButton.disabled = true;
            } else {
                endButton.innerHTML = '<span class="material-symbols-outlined btn-icon">cancel</span> Click to Cancel';
                endButton.style.background = '#ff9800';
                startButton.disabled = true;
            }
            this.showNotification(`📍 Click anywhere on the map to set your ${field === 'start' ? 'start' : 'destination'}`, 'info');
            this.closeSidebarOnMobile();
        } else {
            this.resetMapClickButtons();
            this.clearUnconfirmedMarkers();
            this.showNotification('Map click mode disabled', 'info');
        }
    }

    handleMapClick(latlng) {
        if (!this.mapClickEnabled || !this.mapClickField) return;
        
        this.clearUnconfirmedMarkers();
        
        const marker = L.marker(latlng, {
            icon: L.divIcon({
                className: this.mapClickField === 'start' ? 'custom-start-marker' : 'custom-destination-marker',
                html: this.mapClickField === 'start' ? '⭐' : '🎯',
                iconSize: [30, 30],
                iconAnchor: [15, 30]
            })
        }).addTo(this.map);
        
        // Store temporary marker
        if (this.mapClickField === 'start') {
            this.tempStartMarker = marker;
        } else {
            this.tempDestinationMarker = marker;
        }
        
        // Create popup with use button
        const popupContent = `
            <div style="text-align: center; min-width: 200px;">
                <b>${this.mapClickField === 'start' ? '⭐ Start' : '🎯 Destination'} Location</b><br>
                Coordinates: ${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}<br>
                <button onclick="app.confirmCustomLocation('${this.mapClickField}')" class="control-btn success" style="margin-top: 8px; width: 100%;">
                    Use This ${this.mapClickField === 'start' ? 'Start' : 'Destination'}
                </button>
            </div>
        `;
        
        marker.bindPopup(popupContent).openPopup();
        
        // Remove marker when popup is closed without confirmation
        marker.on('popupclose', () => {
            if ((this.mapClickField === 'start' && marker === this.tempStartMarker) || 
                (this.mapClickField === 'end' && marker === this.tempDestinationMarker)) {
                this.map.removeLayer(marker);
                if (this.mapClickField === 'start') {
                    this.tempStartMarker = null;
                } else {
                    this.tempDestinationMarker = null;
                }
            }
        });
        
        this.showNotification(`📍 Custom ${this.mapClickField} set! Click "Use This ${this.mapClickField === 'start' ? 'Start' : 'Destination'}" to confirm.`, 'success');
    }

    confirmCustomLocation(field) {
        let tempMarker;
        if (field === 'start') {
            tempMarker = this.tempStartMarker;
        } else {
            tempMarker = this.tempDestinationMarker;
        }
        
        if (!tempMarker) {
            this.showNotification(`No custom ${field} set. Click on the map first.`, 'error');
            return;
        }

        const latlng = tempMarker.getLatLng();
        const inputField = field === 'start' ? 'startLocation' : 'endLocation';
        document.getElementById(inputField).value = `Custom ${field === 'start' ? 'Start' : 'Destination'} (${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)})`;
        
        // Convert to permanent marker
        this.convertToPermanentMarker(field, tempMarker, latlng);
        
        // Clean up temporary marker
        tempMarker.closePopup();
        this.map.removeLayer(tempMarker);
        
        if (field === 'start') {
            this.tempStartMarker = null;
        } else {
            this.tempDestinationMarker = null;
        }
        
        this.resetMapClickButtons();
        this.closeSidebarOnMobile();
        this.showNotification(`✅ Custom ${field} set! Now click "Find Jeepney Route"`, 'success');
    }

    // ============================================
    // UTILITY METHODS
    // ============================================
    resetMapClickButtons() {
        const startButton = document.getElementById('startMapClickToggle');
        const endButton = document.getElementById('endMapClickToggle');
        
        startButton.innerHTML = '<span class="material-symbols-outlined btn-icon">place</span> Set Start by Map Click';
        startButton.style.background = '#e3f2fd';
        startButton.disabled = false;
        
        endButton.innerHTML = '<span class="material-symbols-outlined btn-icon">place</span> Set Destination by Map Click';
        endButton.style.background = '#e3f2fd';
        endButton.disabled = false;
        
        this.mapClickEnabled = false;
        this.mapClickField = null;
    }

    clearUnconfirmedMarkers() {
        if (this.tempStartMarker) {
            this.map.removeLayer(this.tempStartMarker);
            this.tempStartMarker = null;
        }
        if (this.tempDestinationMarker) {
            this.map.removeLayer(this.tempDestinationMarker);
            this.tempDestinationMarker = null;
        }
    }

    convertToPermanentMarker(field, tempMarker, latlng) {
        // Remove existing permanent marker
        if (field === 'start' && this.customStartMarker) {
            this.map.removeLayer(this.customStartMarker);
        } else if (field === 'end' && this.customDestinationMarker) {
            this.map.removeLayer(this.customDestinationMarker);
        }
        
        // Create permanent marker
        const permanentMarker = L.marker(latlng, {
            icon: L.divIcon({
                className: field === 'start' ? 'custom-start-marker' : 'custom-destination-marker',
                html: field === 'start' ? '⭐' : '🎯',
                iconSize: [30, 30],
                iconAnchor: [15, 30]
            })
        }).addTo(this.map);
        
        // Store reference
        if (field === 'start') {
            this.customStartMarker = permanentMarker;
        } else {
            this.customDestinationMarker = permanentMarker;
        }
    }

    clearLocationMarkers() {
        if (this.currentLocationMarker) {
            this.map.removeLayer(this.currentLocationMarker);
            this.currentLocationMarker = null;
        }
        if (this.accuracyCircle) {
            this.map.removeLayer(this.accuracyCircle);
            this.accuracyCircle = null;
        }
        if (this.searchRadiusCircle) {
            this.map.removeLayer(this.searchRadiusCircle);
            this.searchRadiusCircle = null;
        }
    }

    clearAllCustomMarkers() {
        this.clearUnconfirmedMarkers();
        
        if (this.customStartMarker) {
            this.map.removeLayer(this.customStartMarker);
            this.customStartMarker = null;
        }
        if (this.customDestinationMarker) {
            this.map.removeLayer(this.customDestinationMarker);
            this.customDestinationMarker = null;
        }
    }

    clearLocationAndRoutes() {
        console.log('Clearing location inputs and routes...');
        
        document.getElementById('startLocation').value = '';
        document.getElementById('endLocation').value = '';
        
        this.userLocation = null;
        this.nearestRoutes = [];
        
        this.clearAllCustomMarkers();
        this.resetMapClickButtons();
        this.clearAllTransferPoints();
        this.clearAllWalkingRoutes();
        this.clearLocationMarkers();
        
        document.getElementById('route-options').innerHTML = '';
        document.getElementById('route-options').style.display = 'none';
        
        routeManager.clearAllRoutesSilently();
        this.map.setView([13.7565, 121.0583], 15);
        
        this.showNotification('🗑️ Cleared!', 'info');
    }

    // ============================================
    // WALKING ROUTES
    // ============================================
    showWalkingRoute(startCoords, endCoords, distance) {
        routeManager.clearAllRoutesSilently();
        
        this.currentWalkingRoute = L.polyline([startCoords, endCoords], {
            color: '#4caf50',
            weight: 4,
            opacity: 0.8,
            dashArray: '5, 5',
            lineCap: 'round'
        }).addTo(this.map);
        
        this.walkingStartMarker = L.marker(startCoords, {
            icon: L.divIcon({
                className: 'walking-marker',
                html: '🚶',
                iconSize: [25, 25],
                iconAnchor: [12, 25]
            })
        })
        .addTo(this.map)
        .bindPopup('<b>Your Location</b><br>Start walking from here')
        .openPopup();
        
        this.walkingEndMarker = L.marker(endCoords, {
            icon: L.divIcon({
                className: 'jeepney-marker',
                html: '🚍',
                iconSize: [25, 25],
                iconAnchor: [12, 25]
            })
        })
        .addTo(this.map)
        .bindPopup('<b>Jeepney Stop</b><br>Nearest pickup point')
        .openPopup();
        
        this.map.fitBounds(this.currentWalkingRoute.getBounds());
        
        const walkingTime = Math.round(distance / 80);
        const detailsDiv = document.getElementById('route-details');
        detailsDiv.innerHTML = `
            <h4>🚶 Walking Route to Jeepney</h4>
            <div class="walking-route-info">
                <p><strong>Distance:</strong> ${Math.round(distance)} meters</p>
                <p><strong>Walking Time:</strong> ${walkingTime} minutes</p>
                <p><strong>Pace:</strong> Normal walking speed (5km/h)</p>
                <p><strong>Tip:</strong> Look for alternative transportation if you have luggage or it's raining</p>
            </div>
            <div style="margin-top: 15px;">
                <button class="control-btn" style="background: #dc3545;" onclick="app.clearWalkingRoute()">
                    🗑️ Clear Walking Route
                </button>
            </div>
        `;
        detailsDiv.style.display = 'block';
    }

    clearWalkingRoute() {
        console.log('Clearing walking route...');
        
        if (this.currentWalkingRoute) {
            this.map.removeLayer(this.currentWalkingRoute);
            this.currentWalkingRoute = null;
        }
        if (this.walkingStartMarker) {
            this.map.removeLayer(this.walkingStartMarker);
            this.walkingStartMarker = null;
        }
        if (this.walkingEndMarker) {
            this.map.removeLayer(this.walkingEndMarker);
            this.walkingEndMarker = null;
        }
        
        document.getElementById('route-details').style.display = 'none';
        this.showNotification('🗑️ Walking route cleared!', 'info');
    }

    clearAllWalkingRoutes() {
        console.log('Clearing all walking routes...');
        
        if (this.currentWalkingRoute) {
            this.map.removeLayer(this.currentWalkingRoute);
            this.currentWalkingRoute = null;
        }
        if (this.walkingStartMarker) {
            this.map.removeLayer(this.walkingStartMarker);
            this.walkingStartMarker = null;
        }
        if (this.walkingEndMarker) {
            this.map.removeLayer(this.walkingEndMarker);
            this.walkingEndMarker = null;
        }
        
        console.log('All walking routes cleared');
    }

    // ============================================
    // LANDMARK METHODS
    // ============================================
    showLandmarksForRoutes(routeNames, startLocation = null, endLocation = null) {
        try {
            this.landmarksLayer.clearLayers();
            
            if (!routeNames || routeNames.length === 0) {
                return;
            }
            
            const connectedLandmarks = new Set();
            const primaryLandmarks = new Set();
            
            routeNames.forEach(routeName => {
                const routeData = jeepneyRoutes[routeName];
                if (routeData) {
                    const boardingZones = this.routeBoardingZones[routeName];
                    if (boardingZones) {
                        boardingZones.primary.forEach(landmark => connectedLandmarks.add(landmark));
                        boardingZones.secondary.forEach(landmark => connectedLandmarks.add(landmark));
                    }
                    
                    const allRoutePoints = [...routeData.waypoints, ...(routeData.secretWaypoints || [])];
                    Object.keys(allStops).forEach(landmark => {
                        const landmarkCoords = allStops[landmark];
                        const distance = this.findDistanceToPoints(landmarkCoords, allRoutePoints).distance;
                        if (distance <= 200) {
                            connectedLandmarks.add(landmark);
                        }
                    });
                }
            });
            
            // Identify start and destination landmarks
            if (startLocation) {
                const matchedStart = this.matchLocationWithLandmarks(startLocation);
                if (matchedStart) {
                    primaryLandmarks.add(matchedStart);
                    connectedLandmarks.delete(matchedStart);
                } else if (startLocation.includes('My Location') && this.userLocation) {
                    this.createCustomStartMarker();
                }
            }
            
            if (endLocation) {
                const matchedEnd = this.matchLocationWithLandmarks(endLocation);
                if (matchedEnd) {
                    primaryLandmarks.add(matchedEnd);
                    connectedLandmarks.delete(matchedEnd);
                }
            }
            
            // Add primary landmarks
            primaryLandmarks.forEach(landmark => {
                if (allStops[landmark]) {
                    L.marker(allStops[landmark], {
                        icon: L.divIcon({
                            className: 'primary-landmark-marker',
                            html: '⭐',
                            iconSize: [45, 45],
                            iconAnchor: [22, 45]
                        })
                    })
                    .bindPopup(`
                        <div style="text-align: center;">
                            <b style="color: #e74c3c; font-size: 1.1em;">${landmark}</b><br>
                            <em>⭐ ${Array.from(primaryLandmarks).indexOf(landmark) === 0 ? 'Start' : 'Destination'} Point</em><br>
                            <small>Connected to: ${Array.from(routeNames).join(', ')}</small>
                        </div>
                    `)
                    .addTo(this.landmarksLayer);
                }
            });
            
            // Add secondary landmarks
            connectedLandmarks.forEach(landmark => {
                if (allStops[landmark]) {
                    L.marker(allStops[landmark], {
                        icon: L.divIcon({
                            className: 'secondary-landmark-marker',
                            html: '📍',
                            iconSize: [35, 35],
                            iconAnchor: [17, 35]
                        })
                    })
                    .bindPopup(`
                        <div style="text-align: center;">
                            <b>${landmark}</b><br>
                            <em>📍 Route Stop</em><br>
                            <small>Connected to: ${Array.from(routeNames).join(', ')}</small>
                        </div>
                    `)
                    .addTo(this.landmarksLayer);
                }
            });
            
            console.log(`Showing ${primaryLandmarks.size} primary and ${connectedLandmarks.size} secondary landmarks for ${routeNames.length} routes`);
            
        } catch (error) {
            console.error('Error showing landmarks:', error);
        }
    }

    // ============================================
    // HELPER METHODS
    // ============================================
    formatFare(fareStr) {
        return this.applyDiscountToFare(fareStr);
    }

    calculateDistance(coord1, coord2) {
        const R = 6371000;
        const lat1 = coord1[0] * Math.PI / 180;
        const lat2 = coord2[0] * Math.PI / 180;
        const deltaLat = (coord2[0] - coord1[0]) * Math.PI / 180;
        const deltaLon = (coord2[1] - coord1[1]) * Math.PI / 180;

        const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
                  Math.cos(lat1) * Math.cos(lat2) *
                  Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c;
    }

    findDistanceToPoints(coords, points) {
        let minDistance = Infinity;
        let closestPoint = null;
        let closestIndex = -1;
        
        points.forEach((point, index) => {
            const distance = this.calculateDistance(coords, point);
            if (distance < minDistance) {
                minDistance = distance;
                closestPoint = point;
                closestIndex = index;
            }
        });
        
        return {
            distance: minDistance,
            point: closestPoint,
            index: closestIndex
        };
    }

    findNearestLandmark(coords) {
        let nearestLandmark = null;
        let minDistance = Infinity;
        
        for (const [landmark, landmarkCoords] of Object.entries(allStops)) {
            const distance = this.calculateDistance(coords, landmarkCoords);
            if (distance < minDistance && distance <= 200) {
                minDistance = distance;
                nearestLandmark = landmark;
            }
        }
        
        return nearestLandmark;
    }

    matchLocationWithLandmarks(locationInput) {
        const cleanInput = locationInput.toLowerCase().trim();
        
        // Direct match
        for (const landmark of Object.keys(allStops)) {
            if (landmark.toLowerCase() === cleanInput) {
                return landmark;
            }
        }
        
        // Partial match
        for (const landmark of Object.keys(allStops)) {
            if (landmark.toLowerCase().includes(cleanInput) || cleanInput.includes(landmark.toLowerCase())) {
                return landmark;
            }
        }
        
        return null;
    }

    getTransportRecommendation(distance) {
        if (distance <= 300) {
            return {
                type: 'walk',
                message: `🚶‍♂️ Walk ${Math.round(distance)}m to jeepney route`,
                time: Math.round(distance / 80),
                color: '#4caf50'
            };
        } else if (distance <= 1000) {
            return {
                type: 'walk',
                message: `🚶‍♂️ Walk ${Math.round(distance)}m to jeepney route`,
                time: Math.round(distance / 80),
                color: '#ff9800'
            };
        } else {
            return {
                type: 'walk',
                message: `🚶‍♂️ Walk ${Math.round(distance)}m to jeepney route`,
                time: Math.round(distance / 80),
                color: '#f44336'
            };
        }
    }

    createCustomStartMarker() {
        if (this.userLocation && this.currentLocationMarker) {
            this.map.removeLayer(this.currentLocationMarker);
            
            this.currentLocationMarker = L.marker(this.userLocation, {
                icon: L.divIcon({
                    className: 'primary-landmark-marker',
                    html: '⭐',
                    iconSize: [45, 45],
                    iconAnchor: [22, 45]
                })
            })
            .addTo(this.map)
            .bindPopup(`
                <b>⭐ Start Location</b><br>
                <em>Your Current Position</em><br>
                Coordinates: ${this.userLocation[0].toFixed(6)}, ${this.userLocation[1].toFixed(6)}
            `)
            .openPopup();
        }
    }

    clearAllTransferPoints() {
        this.map.eachLayer((layer) => {
            if (layer instanceof L.Marker) {
                const icon = layer.options.icon;
                if (icon && icon.options && (
                    icon.options.className === 'transfer-point-marker' ||
                    layer.getPopup && layer.getPopup() && layer.getPopup().getContent().includes('Transfer Point')
                )) {
                    this.map.removeLayer(layer);
                }
            }
            
            if (layer instanceof L.Circle && 
                layer.options.color === '#ff9800' && 
                layer.options.fillColor === '#ff9800') {
                this.map.removeLayer(layer);
            }
        });
    }

    closeSidebarOnMobile() {
        if (window.innerWidth <= 768) {
            const sidebar = document.getElementById('sidebar');
            const toggleCheckbox = document.getElementById('sidebarToggle');
            
            if (sidebar) {
                sidebar.classList.remove('expanded');
            }
            if (toggleCheckbox) {
                toggleCheckbox.checked = false;
            }
            console.log('Sidebar closed on mobile');
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : type === 'info' ? '#17a2b8' : '#6c757d'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            font-weight: bold;
            text-align: center;
            max-width: 300px;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }
    // ============================================
// DISCOUNT HANDLING METHODS
// ============================================

// NEW: Get current discount percentage (20% if enabled)
getCurrentDiscount() {
    const discountEnabled = document.getElementById('discountToggle')?.checked;
    return discountEnabled ? 0.20 : 0; // 20% discount
}

// NEW: Apply 20% discount to fare string with proper rounding
applyDiscountToFare(fareStr) {
    const discountRate = this.getCurrentDiscount();
    if (!fareStr || discountRate === 0) return fareStr;

    const nums = fareStr.match(/(\d+)/g);
    if (!nums) return fareStr;

    // Helper function for rounding
    const roundDown = (num) => Math.floor(num); // For minimum fares
    const roundUp = (num) => Math.ceil(num);    // For maximum fares

    if (nums.length === 1) {
        // Single fare (e.g., ₱13)
        const originalFare = parseInt(nums[0], 10);
        const discountAmount = originalFare * discountRate;
        const discountedFare = Math.max(originalFare - discountAmount, 11);
        
        // Round normally for single fares
        return `₱${Math.round(discountedFare)}`;
    } else {
        // Fare range (e.g., ₱13-18)
        const minOriginal = parseInt(nums[0], 10);
        const maxOriginal = parseInt(nums[1], 10);
        
        const minDiscount = minOriginal * discountRate;
        const maxDiscount = maxOriginal * discountRate;
        
        // Minimum: round down (normal rounding), Maximum: round up
        const minDiscounted = Math.max(roundDown(minOriginal - minDiscount), 11);
        const maxDiscounted = Math.max(roundUp(maxOriginal - maxDiscount), 11);
        
        if (minDiscounted === maxDiscounted) {
            return `₱${minDiscounted}`;
        } else {
            return `₱${minDiscounted}-₱${maxDiscounted}`;
        }
    }
}

updateAllDisplayedFares() {
    const discount = this.getCurrentDiscount();
    console.log('Updating fares with discount:', discount);
    
    // Update route items in the sidebar
    document.querySelectorAll('.route-item').forEach(item => {
        const routeName = item.getAttribute('data-route');
        if (routeName && jeepneyRoutes[routeName]) {
            const originalFare = jeepneyRoutes[routeName].fare;
            const discountedFare = this.applyDiscountToFare(originalFare);
            
            // Update the fare display
            const fareElement = item.querySelector('.route-info');
            if (fareElement) {
                fareElement.innerHTML = `Fare: ${discountedFare}`;
            }
        }
    });
    
    // Update nearest routes
    const nearestRoutes = document.querySelectorAll('.nearest-route-item');
    nearestRoutes.forEach(item => {
        const fareElement = item.querySelector('.route-info');
        if (fareElement) {
            const currentText = fareElement.textContent;
            if (currentText.includes('Fare:')) {
                const fareMatch = currentText.match(/Fare:\s*(₱[\d-]+)/);
                if (fareMatch) {
                    const originalFare = fareMatch[1];
                    const discountedFare = this.applyDiscountToFare(`₱${originalFare}`);
                    fareElement.innerHTML = fareElement.innerHTML.replace(
                        `Fare: ₱${originalFare}`,
                        `Fare: ${discountedFare}`
                    );
                }
            }
        }
    });
    
    // Update route details if displayed
    const routeDetails = document.getElementById('route-details');
    if (routeDetails && routeDetails.style.display !== 'none') {
        let html = routeDetails.innerHTML;
        
        // Update regular fares
        const fareRegex = /Fare:\s*(₱[\d-]+)/g;
        let match;
        while ((match = fareRegex.exec(html)) !== null) {
            const fullMatch = match[0];
            const fareMatch = fullMatch.match(/₱([\d-]+)/);
            if (fareMatch) {
                const originalFare = fareMatch[1];
                const discountedFare = this.applyDiscountToFare(`₱${originalFare}`);
                html = html.replace(`Fare: ₱${originalFare}`, `Fare: ${discountedFare}`);
            }
        }
        
        // Update transfer fares
        const totalFareRegex = /Total Fare:\s*(₱[\d-]+)/g;
        while ((match = totalFareRegex.exec(html)) !== null) {
            const fullMatch = match[0];
            const fareMatch = fullMatch.match(/₱([\d-]+)/);
            if (fareMatch) {
                const originalFare = fareMatch[1];
                const discountedFare = this.applyDiscountToFare(`₱${originalFare}`);
                html = html.replace(`Total Fare: ₱${originalFare}`, `Total Fare: ${discountedFare}`);
            }
        }
        
        routeDetails.innerHTML = html;
    }
    
    // Update route options if displayed - FIXED CHECK
    const routeOptions = document.getElementById('route-options');
    const routeOptionsStyle = window.getComputedStyle(routeOptions);
    
    if (routeOptions && routeOptionsStyle.display !== 'none') {
        console.log('Route options are displayed, updating...');
        
        // Get current start and end locations
        const start = document.getElementById('startLocation').value;
        const end = document.getElementById('endLocation').value;
        
        if (start && end) {
            // Re-plan route to get updated fares with proper formatting
            routePlanner.planRoute();
        } else {
            // If no locations set, just update the existing display
            let html = routeOptions.innerHTML;
            
            // Update individual fares in route options
            const fareRegex = /Fare:\s*(₱[\d-]+)/g;
            let match;
            const matches = [];
            
            // Collect all matches first
            while ((match = fareRegex.exec(html)) !== null) {
                matches.push({
                    full: match[0],
                    index: match.index
                });
            }
            
            // Process matches in reverse to avoid index issues
            for (let i = matches.length - 1; i >= 0; i--) {
                const match = matches[i];
                const fareMatch = match.full.match(/₱([\d-]+)/);
                if (fareMatch) {
                    const originalFare = fareMatch[1];
                    const discountedFare = this.applyDiscountToFare(`₱${originalFare}`);
                    html = html.substring(0, match.index) + 
                           html.substring(match.index).replace(
                               `Fare: ₱${originalFare}`, 
                               `Fare: ${discountedFare}`
                           );
                }
            }
            
            // Update total fares
            const totalFareRegex = /Total:\s*\d+min\s*•\s*Fare:\s*(₱[\d-]+)/g;
            while ((match = totalFareRegex.exec(html)) !== null) {
                const fullMatch = match[0];
                const fareMatch = fullMatch.match(/Fare:\s*(₱[\d-]+)/);
                if (fareMatch) {
                    const fareText = fareMatch[0];
                    const fareAmount = fareMatch[1];
                    const discountedFare = this.applyDiscountToFare(`₱${fareAmount}`);
                    html = html.replace(fareText, `Fare: ${discountedFare}`);
                }
            }
            
            routeOptions.innerHTML = html;
        }
    }
    
    // Update any active route details
    if (routeManager.activeRoutes.length > 0) {
        const activeRoute = routeManager.activeRoutes[0];
        const routeData = jeepneyRoutes[activeRoute];
        if (routeData) {
            // Trigger update of route details
            const hour = 12;
            const routeInfo = {
                distance: 5000,
                duration: 1800
            };
            routeManager.updateRouteDetails(activeRoute, routeData, routeInfo, hour);
        }
    }
    
    this.showNotification(
        discountRate > 0 ? '✅ 20% discount applied!' : 'ℹ️ Regular fares restored',
        discountRate > 0 ? 'success' : 'info'
    );
}
}

// ============================================
// ROUTE MANAGER CLASS
// ============================================
class RouteManager {
    constructor() {
        this.routeLayers = {};
        this.activeRoutes = [];
    }

    // Create direction markers along a polyline
    createDirectionMarkers(routeLayer, routeData) {
        try {
            let latlngs = routeLayer.getLatLngs();
            if (!latlngs) return [];
            
            if (Array.isArray(latlngs[0]) && latlngs[0] && latlngs[0].lat === undefined) {
                latlngs = latlngs.flat();
            }
            if (latlngs.length < 2) return [];

            const bearing = (a, b) => {
                const toRad = d => d * Math.PI / 180;
                const toDeg = r => r * 180 / Math.PI;
                const lat1 = toRad(a.lat);
                const lat2 = toRad(b.lat);
                const dLon = toRad(b.lng - a.lng);
                const y = Math.sin(dLon) * Math.cos(lat2);
                const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
                return (toDeg(Math.atan2(y, x)) + 360) % 360;
            };

            // Color utilities
            const hexToRgb = (hex) => {
                if (!hex) return null;
                const h = hex.replace('#', '');
                if (h.length === 5) {
                    return {
                        r: parseInt(h.substring(0,2), 16),
                        g: parseInt(h.substring(2,4), 16),
                        b: parseInt(h.substring(4,6), 16)
                    };
                }
                return null;
            };

            const rgbToHex = (r,g,b) => {
                const toHex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
                return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
            };

            const luminance = (r,g,b) => {
                const srgb = [r,g,b].map(v => v/255).map(c => c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4));
                return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
            };

            const mixColors = (hex1, hex2, weight = 0.5) => {
                const c1 = hexToRgb(hex1) || {r:34,g:34,b:34};
                const c2 = hexToRgb(hex2) || {r:255,g:255,b:255};
                const r = c1.r * (1-weight) + c2.r * weight;
                const g = c1.g * (1-weight) + c2.g * weight;
                const b = c1.b * (1-weight) + c2.b * weight;
                return rgbToHex(r,g,b);
            };

            // Create SVG arrow
            const makeSvgFor = (deg, color) => {
                const base = color || '#333';
                const rgb = hexToRgb(base);
                let arrowColor = base;
                if (rgb) {
                    const lum = luminance(rgb.r, rgb.g, rgb.b);
                    if (lum > 0.7) {
                        arrowColor = mixColors(base, '#000000', 0.45);
                    } else {
                        arrowColor = mixColors(base, '#ffffff', 0.45);
                    }
                }

                const rot = (deg - 90 + 360) % 360;
                const c = arrowColor;
                
                return `
                    <svg width="28" height="28" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="transform: rotate(${rot}deg); display:block;">
                        <path d="M2 12 L16 12" stroke="#000" stroke-width="4" stroke-linecap="round" opacity="0.9" />
                        <path d="M2 12 L16 12" stroke="${c}" stroke-width="2" stroke-linecap="round" />
                        <path d="M10 6 L18 12 L10 18 Z" fill="#000" stroke="#000" stroke-width="1.5" stroke-linejoin="round" />
                        <path d="M10 6 L18 12 L10 18 Z" fill="${c}" stroke="#000" stroke-width="0.8" stroke-linejoin="round" />
                    </svg>
                `;
            };

            // Densify long segments
            const densified = [];
            for (let i = 0; i < latlngs.length - 1; i++) {
                const a = latlngs[i];
                const b = latlngs[i + 1];
                densified.push(a);

                let segDist = null;
                try {
                    segDist = app && typeof app.calculateDistance === 'function' ? app.calculateDistance([a.lat, a.lng], [b.lat, b.lng]) : null;
                } catch (e) {
                    segDist = null;
                }

                const maxChunk = 120;
                if (segDist && segDist > maxChunk) {
                    const parts = Math.ceil(segDist / maxChunk);
                    for (let p = 1; p < parts; p++) {
                        const t = p / parts;
                        const lat = a.lat + (b.lat - a.lat) * t;
                        const lng = a.lng + (b.lng - a.lng) * t;
                        densified.push({ lat, lng });
                    }
                }
            }
            densified.push(latlngs[latlngs.length - 1]);

            const totalSegments = densified.length - 1;
            if (totalSegments < 1) return [];

            const desired = Math.min(25, Math.max(3, Math.floor(totalSegments / 4) + 1));
            const step = Math.max(1, Math.floor(totalSegments / desired));

            const markers = [];
            for (let i = 0; i < totalSegments; i += step) {
                const a = densified[i];
                const b = densified[i + 1];

                const lat = a.lat + (b.lat - a.lat) * 0.5;
                const lng = a.lng + (b.lng - a.lng) * 0.5;
                const pos = L.latLng(lat, lng);

                const pIndex = Math.max(0, i - 1);
                const nIndex = Math.min(densified.length - 1, i + 2);
                const p = densified[pIndex];
                const n = densified[nIndex];
                const deg = bearing(p, n);

                const svg = makeSvgFor(deg, routeData && routeData.color ? routeData.color : '#222');

                const marker = L.marker(pos, {
                    icon: L.divIcon({
                        className: 'direction-marker',
                        html: svg,
                        iconSize: [28, 28],
                        iconAnchor: [14, 14]
                    }),
                    interactive: false
                }).addTo(app.map);

                markers.push(marker);
            }

            return markers;
        } catch (err) {
            console.warn('Error creating direction markers:', err);
            return [];
        }
    }

    async createSnappedRoute(routeName, routeData) {
        const hour = 12;
        
        try {
            document.getElementById('loading').style.display = 'block';
            
            // Clear all routes first
            this.clearAllRoutesSilently();
            
            const route = await this.getRouteWithETA(
                routeData.waypoints, 
                routeData.secretWaypoints || [], 
                hour
            );
            
            const latlngs = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
            
            const routeLayer = L.polyline(latlngs, {
                color: routeData.color,
                weight: 3,
                opacity: 0.8,
                lineCap: 'round',
                lineJoin: 'round'
            }).addTo(app.map);

            // Add direction markers
            let directionMarkers = [];
            try {
                directionMarkers = this.createDirectionMarkers(routeLayer, routeData);
            } catch (err) {
                console.warn('Error creating direction markers:', err);
                directionMarkers = [];
            }

            this.routeLayers[routeName] = {
                route: routeLayer,
                waypoints: null,
                directionMarkers: directionMarkers,
                data: routeData
            };
            
            if (!this.activeRoutes.includes(routeName)) {
                this.activeRoutes.push(routeName);
            }
            
            // Fit bounds to the route
            app.map.fitBounds(routeLayer.getBounds(), { padding: [20, 20] });
            
            const startLocation = document.getElementById('startLocation').value;
            const endLocation = document.getElementById('endLocation').value;
            app.showLandmarksForRoutes([routeName], startLocation, endLocation);

            this.updateRouteDetails(routeName, routeData, route, hour);
            this.updateActiveRoute(routeName);
            
            // Close sidebar on mobile
            app.closeSidebarOnMobile();
            
        } catch (error) {
            console.error('Error creating route:', error);
        } finally {
            document.getElementById('loading').style.display = 'none';
        }
    }

    async getRouteWithETA(waypoints, secretWaypoints, hour) {
        try {
            const allPoints = [waypoints[0], ...secretWaypoints, waypoints[waypoints.length - 1]];
            const coordinates = allPoints.map(wp => `${wp[1]},${wp[0]}`).join(';');
            
            const response = await fetch(
                `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`
            );
            
            if (!response.ok) throw new Error('Routing failed');
            
            const data = await response.json();
            if (data.code !== 'Ok') throw new Error('Route not found');
            
            return data.routes[0];
        } catch (error) {
            console.error('Routing error:', error);
            return {
                geometry: {
                    type: 'LineString',
                    coordinates: waypoints.map(wp => [wp[1], wp[0]])
                },
                distance: 0,
                duration: 0
            };
        }
    }

    clearAllRoutesSilently() {
        console.log('Clearing all routes silently...');
        
        Object.keys(this.routeLayers).forEach(routeName => {
            const layerGroup = this.routeLayers[routeName];
            
            if (layerGroup.route) {
                try {
                    if (app.map.hasLayer(layerGroup.route)) {
                        app.map.removeLayer(layerGroup.route);
                    }
                } catch (error) {
                    console.warn(`Error removing route layer for ${routeName}:`, error);
                }
            }
            
            if (layerGroup.directionMarkers && Array.isArray(layerGroup.directionMarkers)) {
                try {
                    layerGroup.directionMarkers.forEach(m => {
                        if (m && app.map.hasLayer(m)) app.map.removeLayer(m);
                    });
                } catch (error) {
                    console.warn(`Error removing direction markers for ${routeName}:`, error);
                }
            }
        });
        
        this.routeLayers = {};
        this.activeRoutes = [];

        // Clear landmarks
        app.landmarksLayer.clearLayers();
        
        document.getElementById('route-details').style.display = 'none';
        document.querySelectorAll('.route-item').forEach(item => {
            item.classList.remove('active');
        });
        
        console.log('All routes cleared silently');
    }
    
    async showAllRoutes() {
        this.clearAllRoutesSilently();
        
        const hour = 12;
        let routesLoaded = 0;
        
        document.getElementById('loading').style.display = 'block';
        
        try {
            for (const [routeName, routeData] of Object.entries(jeepneyRoutes)) {
                try {
                    const route = await this.getRouteWithETA(
                        routeData.waypoints, 
                        routeData.secretWaypoints || [], 
                        hour
                    );
                    const latlngs = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
                    
                    const routeLayer = L.polyline(latlngs, {
                        color: routeData.color,
                        weight: 3,
                        opacity: 0.6,
                        lineCap: 'round',
                        className: 'route-line'
                    }).addTo(app.map);

                    // Add direction markers
                    let directionMarkers = [];
                    try {
                        directionMarkers = this.createDirectionMarkers(routeLayer, routeData);
                    } catch (err) {
                        console.warn('Error creating direction markers for showAllRoutes:', err);
                        directionMarkers = [];
                    }

                    this.routeLayers[routeName] = {
                        route: routeLayer,
                        waypoints: null,
                        directionMarkers: directionMarkers,
                        data: routeData
                    };
                    
                    this.activeRoutes.push(routeName);
                    routesLoaded++;
                    
                } catch (error) {
                    console.error(`Error showing route ${routeName}:`, error);
                }
            }
            
            // Show landmarks for all routes
            const startLocation = document.getElementById('startLocation').value;
            const endLocation = document.getElementById('endLocation').value;
            app.showLandmarksForRoutes(this.activeRoutes, startLocation, endLocation);
            
            if (routesLoaded > 0) {
                app.showNotification(`✅ Showing all ${routesLoaded} jeepney routes!`, 'success');
            } else {
                app.showNotification('❌ No routes could be loaded', 'error');
            }
            
        } catch (error) {
            console.error('Error showing all routes:', error);
            app.showNotification('❌ Error loading routes', 'error');
        } finally {
            document.getElementById('loading').style.display = 'none';
            document.getElementById('route-details').style.display = 'none';
        }
    }

    updateActiveRoute(routeName) {
        document.querySelectorAll('.route-item').forEach(item => {
            item.classList.remove('active');
        });
        const activeItem = document.querySelector(`[data-route="${routeName}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
        }
    }

    updateRouteDetails(routeName, routeData, routeInfo, hour) {
        const currentDetails = document.getElementById('route-details').innerHTML;
        if (currentDetails.includes('Transfer Route')) {
            return;
        }
        
        const detailsDiv = document.getElementById('route-details');
        const distance = routeInfo.distance ? (routeInfo.distance / 1000).toFixed(1) : 'N/A';
        const totalMinutes = routeInfo.duration ? Math.round(routeInfo.duration / 60) : 
                            routePlanner.calculateTravelTime(routeInfo.distance || 5000);
        
        detailsDiv.innerHTML = `
            <div class="transfer-route-clean">
                <h4>${routeName}</h4>
                <div class="transfer-leg">
                    <p><strong>Distance:</strong> ${distance} km</p>
                    <p><strong>Estimated Time:</strong> ${totalMinutes} minutes</p>
                    <p><strong>Fare:</strong> ${app.formatFare(routeData.fare)}</p>
                </div>
            </div>
        `;
        detailsDiv.style.display = 'block';
        this.ensureProperLayout();
    }

    clearAllRoutes() {
        console.log('Clearing all routes...');
        
        app.clearAllWalkingRoutes();
        
        Object.keys(this.routeLayers).forEach(routeName => {
            const layerGroup = this.routeLayers[routeName];
            
            if (layerGroup.route) {
                try {
                    if (app.map.hasLayer(layerGroup.route)) {
                        app.map.removeLayer(layerGroup.route);
                    }
                } catch (error) {
                    console.warn(`Error removing route layer for ${routeName}:`, error);
                }
            }
            
            if (layerGroup.directionMarkers && Array.isArray(layerGroup.directionMarkers)) {
                try {
                    layerGroup.directionMarkers.forEach(m => {
                        if (m && app.map.hasLayer(m)) app.map.removeLayer(m);
                    });
                } catch (error) {
                    console.warn(`Error removing direction markers for ${routeName}:`, error);
                }
            }
        });
        
        this.routeLayers = {};
        this.activeRoutes = [];
        
        document.getElementById('route-details').style.display = 'none';
        document.querySelectorAll('.route-item').forEach(item => {
            item.classList.remove('active');
        });
        
        app.map.setView([13.7565, 121.0583], 13);
        
        console.log('All routes cleared successfully');
        alert('All routes cleared!');
    }

    ensureProperLayout() {
        const detailsDiv = document.getElementById('route-details');
        const routesList = document.getElementById('routes-list');
        const sidebar = document.getElementById('sidebar');
        
        if (detailsDiv && routesList && sidebar) {
            if (detailsDiv.parentNode === sidebar) sidebar.removeChild(detailsDiv);
            if (routesList.parentNode === sidebar) sidebar.removeChild(routesList);
            
            sidebar.appendChild(detailsDiv);
            sidebar.appendChild(routesList);
        }
    }
}

// ============================================
// ROUTE PLANNER CLASS
// ============================================
class RoutePlanner {
    async planRoute() {
        const start = document.getElementById('startLocation').value;
        const end = document.getElementById('endLocation').value;
        
        if (!start || !end) {
            alert('Please enter both start and end locations');
            return;
        }
        
        document.getElementById('loading').style.display = 'block';
        document.getElementById('route-options').style.display = 'none';
        
        try {
            let startCoords, endCoords;
            
            // Get coordinates for start location
            if (start.includes('My Location') && app.userLocation) {
                startCoords = app.userLocation;
            } else if (start.includes('Custom Destination') && app.customDestinationMarker) {
                const latlng = app.customDestinationMarker.getLatLng();
                startCoords = [latlng.lat, latlng.lng];
            } else {
                startCoords = await this.geocodeAddress(start);
            }
            
            // Get coordinates for end location  
            if (end.includes('My Location') && app.userLocation) {
                endCoords = app.userLocation;
            } else if (end.includes('Custom Destination') && app.customDestinationMarker) {
                const latlng = app.customDestinationMarker.getLatLng();
                endCoords = [latlng.lat, latlng.lng];
            } else {
                endCoords = await this.geocodeAddress(end);
            }
            
            if (!startCoords || !endCoords) {
                throw new Error('Could not find one or both locations');
            }
            
            console.log('Route planning between:', startCoords, 'and', endCoords);
            
            // Find route options
            const routeOptions = this.findRouteOptions(startCoords, endCoords);
            this.displayRouteOptions(routeOptions, start, end, startCoords, endCoords);
            
        } catch (error) {
            console.error('Route planning error:', error);
            document.getElementById('route-options').innerHTML = 
                `<p style="color: #dc3545; text-align: center;">Error: ${error.message}</p>`;
        } finally {
            document.getElementById('loading').style.display = 'none';
            document.getElementById('route-options').style.display = 'block';
        }
    }

    calculateDistance(coord1, coord2) {
        const R = 6371000;
        const lat1 = coord1[0] * Math.PI / 180;
        const lat2 = coord2[0] * Math.PI / 180;
        const deltaLat = (coord2[0] - coord1[0]) * Math.PI / 180;
        const deltaLon = (coord2[1] - coord1[1]) * Math.PI / 180;

        const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
                  Math.cos(lat1) * Math.cos(lat2) *
                  Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c;
    }

    calculateTravelTime(distanceMeters) {
        const speedKmh = 14;
        const speedMs = speedKmh * 1000 / 3600;
        const timeSeconds = distanceMeters / speedMs;
        const timeMinutes = Math.round(timeSeconds / 60);
        
        return Math.max(1, timeMinutes);
    }

    findRouteOptions(startCoords, endCoords) {
        const routeOptions = [];
        
        console.log('Finding routes from:', startCoords, 'to:', endCoords);
        
        // Calculate direct distance
        const directDistance = this.calculateDistance(startCoords, endCoords);
        const directTime = this.calculateTravelTime(directDistance);
        
        // Check each route
        Object.entries(jeepneyRoutes).forEach(([routeName, routeData]) => {
            const routePoints = [...routeData.waypoints, ...(routeData.secretWaypoints || [])];
            
            const startProximity = this.findDistanceToPoints(startCoords, routePoints);
            const endProximity = this.findDistanceToPoints(endCoords, routePoints);
            
            const canServeTrip = this.canRouteServeTrip(startCoords, endCoords, routePoints, routeData);
            
            if (canServeTrip) {
                const startWalkDistance = startProximity.distance;
                const endWalkDistance = endProximity.distance;
                const startWalkTime = Math.round(startWalkDistance / 80);
                const endWalkTime = Math.round(endWalkDistance / 80);
                
                const routeSegmentDistance = this.calculateDistance(startProximity.point, endProximity.point);
                const routeTime = this.calculateTravelTime(routeSegmentDistance);
                
                const totalTime = startWalkTime + routeTime + endWalkTime;
                const fare = this.extractFare(routeData.fare);
                
                const score = this.calculateRouteScore(
                    startWalkDistance, 
                    endWalkDistance, 
                    totalTime, 
                    fare, 
                    routeName
                );
                
                routeOptions.push({
                    type: 'direct',
                    routeName: routeName,
                    routeData: routeData,
                    startWalk: { distance: startWalkDistance, time: startWalkTime },
                    endWalk: { distance: endWalkDistance, time: endWalkTime },
                    routeTime: routeTime,
                    routeDistance: routeSegmentDistance,
                    totalTime: totalTime,
                    totalFare: fare,
                    score: score, 
                    confidence: this.calculateConfidence(startWalkDistance, endWalkDistance),
                    description: `Direct route via ${routeName}`
                });
            }
        });
        
        // Find transfer options
        const transferOptions = this.findTransferOptions(startCoords, endCoords);
        routeOptions.push(...transferOptions);
        
        // Sort and return top options
        return routeOptions
            .sort((a, b) => {
                if (a.score !== b.score) {
                    return b.score - a.score;
                }
                
                if (a.totalTime !== b.totalTime) {
                    return a.totalTime - b.totalTime;
                }
                
                const confidenceOrder = { high: 3, medium: 2, low: 1 };
                return confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
            })
            .slice(0, 6);
    }

    calculateRouteScore(startWalkDistance, endWalkDistance, totalTime, fare, routeName) {
        let score = 0;
        
        // Walking distance score
        const maxWalkDistance = 1000;
        const walkScore = Math.max(0, 100 - ((startWalkDistance + endWalkDistance) / maxWalkDistance * 100));
        score += walkScore;
        
        if (startWalkDistance <= 300 && endWalkDistance <= 300) {
            score += 50;
        }
        
        // Time score
        const maxExpectedTime = 60;
        const timeScore = Math.max(0, 100 - (totalTime / maxExpectedTime * 100));
        score += timeScore;
        
        // Route type preference
        const routeData = jeepneyRoutes[routeName];
        if (routeData.type === 'main') score += 20;
        if (routeData.type === 'feeder') score += 10;
        
        // Specific route preferences
        const preferredRoutes = ["Batangas - Alangilan"];
        if (preferredRoutes.includes(routeName)) {
            score += 30;
        }
        
        // Penalty for long walks
        if (startWalkDistance > 200 || endWalkDistance > 200) {
            score -= 40;
        }
        
        return Math.round(score);
    }

    canRouteServeTrip(startCoords, endCoords, routePoints, routeData) {
        if (routePoints.length < 2) return false;
        
        const startNearest = this.findNearestPointOnRoute(startCoords, routeData);
        const endNearest = this.findNearestPointOnRoute(endCoords, routeData);
        
        // Check distance
        if (startNearest.distance > 800 || endNearest.distance > 800) {
            return false;
        }

        // Circular routes
        if (routeData.description.toLowerCase().includes('circular')) {
            const startIndex = this.findPointIndexInRoute(startNearest.point, routePoints);
            const endIndex = this.findPointIndexInRoute(endNearest.point, routePoints);
            const pointDifference = Math.abs(startIndex - endIndex);
            return pointDifference >= 3;
        }

        // Direction check for linear routes
        if (!this.doesRouteGoTowardDestination(startCoords, endCoords, routeData)) {
            return false;
        }
        
        // Check point distance
        const startIndex = this.findPointIndexInRoute(startNearest.point, routePoints);
        const endIndex = this.findPointIndexInRoute(endNearest.point, routePoints);
        const pointDifference = Math.abs(startIndex - endIndex);
        
        return pointDifference >= 1; 
    }

    findDistanceToPoints(coords, points) {
        let minDistance = Infinity;
        let closestPoint = null;
        let closestIndex = -1;
        
        points.forEach((point, index) => {
            const distance = this.calculateDistance(coords, point);
            if (distance < minDistance) {
                minDistance = distance;
                closestPoint = point;
                closestIndex = index;
            }
        });
        
        return {
            distance: minDistance,
            point: closestPoint,
            index: closestIndex
        };
    }

    calculateConfidence(startWalkDistance, endWalkDistance) {
        if (startWalkDistance <= 300 && endWalkDistance <= 300) return 'high';
        if (startWalkDistance <= 500 && endWalkDistance <= 500) return 'medium';
        return 'low';
    }

    findTransferOptions(startCoords, endCoords) {
        const transferOptions = [];
        const allRoutes = Object.entries(jeepneyRoutes);
        
        // Find routes near start
        const startRoutes = allRoutes.filter(([name, data]) => 
            this.findDistanceToRoute(startCoords, data) <= 800
        );
        
        // Find routes near end  
        const endRoutes = allRoutes.filter(([name, data]) =>
            this.findDistanceToRoute(endCoords, data) <= 800
        );
        
        // Find possible transfers
        startRoutes.forEach(([startName, startData]) => {
            endRoutes.forEach(([endName, endData]) => {
                if (startName !== endName) {
                    if (this.areRoutesCompatible(startName, endName)) {
                        const transferPoint = this.findTransferPoint(startData, endData);
                        if (transferPoint && transferPoint.distance <= 300) {
                            const option = this.createTransferOption(
                                startCoords, endCoords, 
                                startName, startData, 
                                endName, endData, 
                                transferPoint
                            );
                            if (option) transferOptions.push(option);
                        }
                    }
                }
            });
        });
        
        return transferOptions;
    }

    findTransferPoint(route1, route2) {
        const route1Points = [...route1.waypoints, ...(route1.secretWaypoints || [])];
        const route2Points = [...route2.waypoints, ...(route2.secretWaypoints || [])];
        
        let bestTransfer = null;
        let minDistance = Infinity;
        
        route1Points.forEach(point1 => {
            route2Points.forEach(point2 => {
                const distance = this.calculateDistance(point1, point2);
                if (distance < minDistance && distance <= 300) {
                    minDistance = distance;
                    bestTransfer = {
                        point: point1,
                        distance: distance,
                        walkTime: Math.round(distance / 80)
                    };
                }
            });
        });
        
        return bestTransfer;
    }

    createTransferOption(startCoords, endCoords, startRouteName, startData, endRouteName, endData, transfer) {
        const startWalkDistance = this.findDistanceToRoute(startCoords, startData);
        const endWalkDistance = this.findDistanceToRoute(endCoords, endData);
        
        if (startWalkDistance > 1000 || endWalkDistance > 1000) return null;
        
        const startWalkTime = Math.round(startWalkDistance / 80);
        const endWalkTime = Math.round(endWalkDistance / 80);
        const transferWalkTime = transfer.walkTime;
        
        // Estimate route times
        const route1Distance = this.calculateDistance(
            this.findNearestPointOnRoute(startCoords, startData).point,
            transfer.point
        );
        const route2Distance = this.calculateDistance(
            transfer.point,
            this.findNearestPointOnRoute(endCoords, endData).point
        );
        
        const route1Time = this.calculateTravelTime(route1Distance);
        const route2Time = this.calculateTravelTime(route2Distance);
        
        const totalTime = startWalkTime + route1Time + transferWalkTime + route2Time + endWalkTime + 5;
        const totalFare = this.extractFare(startData.fare) + this.extractFare(endData.fare);
        
        return {
            type: 'transfer',
            routeNames: [startRouteName, endRouteName],
            routeData: [startData, endData],
            startWalk: { distance: startWalkDistance, time: startWalkTime },
            endWalk: { distance: endWalkDistance, time: endWalkTime },
            transfer: {
                point: transfer.point,
                distance: transfer.distance,
                walkTime: transfer.walkTime,
                nearestLandmark: this.findNearestLandmarkToTransfer(transfer.point)
            },
            routeTimes: [route1Time, route2Time],
            routeDistances: [route1Distance, route2Distance],
            totalTime: totalTime,
            totalFare: totalFare,
            confidence: 'medium',
            description: `${startRouteName} → ${endRouteName}`
        };
    }

    findNearestLandmarkToTransfer(transferPoint) {
        let nearestLandmark = null;
        let minDistance = Infinity;
        
        for (const [landmark, landmarkCoords] of Object.entries(allStops)) {
            const distance = this.calculateDistance(transferPoint, landmarkCoords);
            if (distance < minDistance && distance <= 300) {
                minDistance = distance;
                nearestLandmark = landmark;
            }
        }
        
        return nearestLandmark;
    }

    displayRouteOptions(routeOptions, start, end, startCoords, endCoords) {
        if (routeOptions.length === 0) {
            document.getElementById('route-options').innerHTML = 
                `<div class="no-routes-found">
                    <h5>❌ No Routes Found</h5>
                    <p>No jeepney routes found from <strong>${start}</strong> to <strong>${end}</strong>.</p>
                    <p>Try using more specific location names or use "My Location".</p>
                </div>`;
            return;
        }
        
        let html = `<h5>🚍 Route Options (${routeOptions.length} found):</h5>`;
        
        routeOptions.forEach((option, index) => {
            if (option.type === 'direct') {
                html += this.formatDirectOption(option.routeData, option, index, startCoords, endCoords);
            } else if (option.type === 'transfer') {
                html += this.formatTransferOption(option, index);
            }
        });
        
        document.getElementById('route-options').innerHTML = html;
    }

    formatDirectOption(routeData, option, index, startCoords, endCoords) {
        const confidenceClass = option.confidence === 'high' ? 'confidence-high' : 
                            option.confidence === 'medium' ? 'confidence-medium' : 'confidence-low';
        
        // Get the discounted fare
        const discountedFare = app.formatFare(routeData.fare);
        
        return `
            <div class="route-option-clean">
                <div class="option-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <strong>${index + 1}. ${option.routeName}</strong>
                    <span class="confidence-badge-clean ${confidenceClass}" title="${option.confidence} confidence"></span>
                </div>
                <div class="route-leg-clean">
                    <div class="route-step-clean">
                        <span class="arrow-clean">→</span>
                        <span class="step-type">Walk</span>
                        <span class="step-detail">${Math.round(option.startWalk.distance)}m</span>
                    </div>
                    <div class="route-step-clean">
                        <span class="arrow-clean">→</span>
                        <span class="step-type">Jeepney</span>
                        <span class="step-detail">${option.routeName}</span>
                        <div style="font-size: 11px; color: #666; margin-left: 10px;">
                            ${option.routeTime} min • ${Math.round(option.routeDistance)}m
                        </div>
                    </div>
                    <div class="route-step-clean">
                        <span class="arrow-clean">→</span>
                        <span class="step-type">Walk</span>
                        <span class="step-detail">${Math.round(option.endWalk.distance)}m</span>
                    </div>
                </div>
                <div class="route-summary-clean">
                    Total: ${option.totalTime}min • Fare: ${discountedFare}
                </div>
                <button class="control-btn success" onclick="routeManager.createSnappedRoute('${option.routeName}', jeepneyRoutes['${option.routeName}'])" style="margin-top: 10px; width: 100%;">
                    Show This Route
                </button>
            </div>
        `;
    }

    formatTransferOption(option, index) {
        const confidenceClass = 'confidence-medium';
        const transferFare = this.calculateTransferFare(option.routeData[0].fare, option.routeData[1].fare);
        
        return `
            <div class="route-option-clean transfer-route">
                <div class="option-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <strong>${index + 1}. ${option.routeNames[0]} + ${option.routeNames[1]}</strong>
                    <span class="confidence-badge-clean ${confidenceClass}" title="medium confidence"></span>
                </div>
                <div class="route-leg-clean">
                    <div class="route-step-clean">
                        <span class="arrow-clean">→</span>
                        <span class="step-type">Walk</span>
                        <span class="step-detail">${Math.round(option.startWalk.distance)}m</span>
                    </div>
                    <div class="route-step-clean">
                        <span class="arrow-clean">→</span>
                        <span class="step-type">Jeepney</span>
                        <span class="step-detail">${option.routeNames[0]}</span>
                        <div style="font-size: 11px; color: #666; margin-left: 10px;">
                            ${option.routeTimes[0]} min • ${Math.round(option.routeDistances[0])}m
                        </div>
                    </div>
                    <div class="route-step-clean">
                        <span class="arrow-clean">→</span>
                        <span class="step-type">Transfer</span>
                        <span class="step-detail">${Math.round(option.transfer.distance)}m</span>
                    </div>
                    <div class="route-step-clean">
                        <span class="arrow-clean">→</span>
                        <span class="step-type">Jeepney</span>
                        <span class="step-detail">${option.routeNames[1]}</span>
                        <div style="font-size: 11px; color: #666; margin-left: 10px;">
                            ${option.routeTimes[1]} min • ${Math.round(option.routeDistances[1])}m
                        </div>
                    </div>
                    <div class="route-step-clean">
                        <span class="arrow-clean">→</span>
                        <span class="step-type">Walk</span>
                        <span class="step-detail">${Math.round(option.endWalk.distance)}m</span>
                    </div>
                </div>
                <div class="route-summary-clean">
                    Total: ${option.totalTime}min • Fare: ${transferFare}
                </div>
                
                <button class="control-btn success" onclick="routePlanner.showTransferRouteWithStops(['${option.routeNames[0]}', '${option.routeNames[1]}'], ${JSON.stringify(option.transfer).replace(/"/g, '&quot;')})" style="margin-top: 10px; width: 100%;">
                    Show Transfer Points
                </button>
            </div>
        `;
    }

    calculateTransferFare(route1Fare, route2Fare) {
        const discountRate = app.getCurrentDiscount ? app.getCurrentDiscount() : 0;
        
        const calculateDiscountedFare = (fareStr) => {
            const nums = fareStr.match(/(\d+)/g);
            if (!nums) return { min: 0, max: 0 };
            
            // Rounding functions
            const roundDown = (num) => Math.floor(num);
            const roundUp = (num) => Math.ceil(num);
            
            if (nums.length === 1) {
                const original = parseInt(nums[0], 10);
                const discount = original * discountRate;
                const discounted = Math.max(original - discount, 11);
                // Single fare: round normally
                const roundedFare = Math.round(discounted);
                return { min: roundedFare, max: roundedFare };
            } else {
                const minOriginal = parseInt(nums[0], 10);
                const maxOriginal = parseInt(nums[1], 10);
                
                const minDiscount = minOriginal * discountRate;
                const maxDiscount = maxOriginal * discountRate;
                
                // Minimum: round down, Maximum: round up
                const minDiscounted = Math.max(roundDown(minOriginal - minDiscount), 11);
                const maxDiscounted = Math.max(roundUp(maxOriginal - maxDiscount), 11);
                
                return { min: minDiscounted, max: maxDiscounted };
            }
        };
        
        const fare1 = calculateDiscountedFare(route1Fare);
        const fare2 = calculateDiscountedFare(route2Fare);
        
        const totalMin = fare1.min + fare2.min;
        const totalMax = fare1.max + fare2.max;
        
        if (totalMin === totalMax) {
            return `₱${totalMin}`;
        } else {
            return `₱${totalMin}-₱${totalMax}`;
        }
    }

    async showTransferRouteWithStops(routeNames, transferPoint) {
        routeManager.clearAllRoutesSilently();
        document.getElementById('loading').style.display = 'block';
        
        try {
            const routeLayers = [];
            
            for (const routeName of routeNames) {
                const routeData = jeepneyRoutes[routeName];
                if (routeData) {
                    const route = await routeManager.getRouteWithETA(
                        routeData.waypoints, 
                        routeData.secretWaypoints || [], 
                        12
                    );
                    
                    const latlngs = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
                    
                    const routeLayer = L.polyline(latlngs, {
                        color: routeData.color,
                        weight: 6,
                        opacity: 0.8,
                        lineCap: 'round',
                        lineJoin: 'round'
                    }).addTo(app.map);
                    
                    routeLayers.push({
                        routeName: routeName,
                        layer: routeLayer,
                        data: routeData
                    });

                    // Add direction markers
                    let directionMarkers = [];
                    try {
                        directionMarkers = routeManager.createDirectionMarkers(routeLayer, routeData);
                    } catch (err) {
                        console.warn('Error creating direction markers for transfer stops display:', err);
                        directionMarkers = [];
                    }

                    routeManager.routeLayers[routeName] = {
                        route: routeLayer,
                        waypoints: null,
                        directionMarkers: directionMarkers,
                        data: routeData
                    };
                    
                    if (!routeManager.activeRoutes.includes(routeName)) {
                        routeManager.activeRoutes.push(routeName);
                    }
                }
            }
            
            // Fit bounds to show all routes
            if (routeLayers.length > 0) {
                const group = new L.featureGroup(routeLayers.map(r => r.layer));
                app.map.fitBounds(group.getBounds(), { padding: [20, 20] });
            }
            
            // Add transfer point marker
            this.addTransferPointMarker(transferPoint, routeNames);
            
            // Show landmarks
            const startLocation = document.getElementById('startLocation').value;
            const endLocation = document.getElementById('endLocation').value;
            app.showLandmarksForRoutes(routeNames, startLocation, endLocation);
            
            // Update route details
            this.updateTransferRouteDetails(routeNames, transferPoint);
            
            // Close sidebar on mobile
            app.closeSidebarOnMobile();
            
        } catch (error) {
            console.error('Error showing transfer route:', error);
            alert('Error displaying transfer routes. Please try again.');
        } finally {
            document.getElementById('loading').style.display = 'none';
        }
    }

    addTransferPointMarker(transferPoint, routeNames) {
        if (!transferPoint || !transferPoint.point) return;
        
        const nearestLandmark = this.findNearestLandmarkToTransfer(transferPoint.point);
        const landmarkInfo = nearestLandmark ? `<br><small>Near: ${nearestLandmark}</small>` : '';
        
        L.marker(transferPoint.point, {
            icon: L.divIcon({
                className: 'transfer-point-marker',
                html: '🔄',
                iconSize: [30, 30],
                iconAnchor: [15, 30]
            })
        })
        .addTo(app.map)
        .bindPopup(`
            <div style="text-align: center; max-width: 250px;">
                <b style="color: #ff9800;">🔄 Transfer Point</b><br>
                <strong>Switch from:</strong> ${routeNames[0]}<br>
                <strong>Switch to:</strong> ${routeNames[1]}${landmarkInfo}
            </div>
        `);
        
        // Add walking route circle
        L.circle(transferPoint.point, {
            radius: Math.min(transferPoint.distance, 200),
            color: '#ff9800',
            fillColor: '#ff9800',
            fillOpacity: 0.1,
            weight: 2,
            dashArray: '5, 5'
        })
        .addTo(app.map)
        .bindPopup('Transfer walking area');
    }

    updateTransferRouteDetails(routeNames, transferPoint) {
        const detailsDiv = document.getElementById('route-details');
        
        const route1Data = jeepneyRoutes[routeNames[0]];
        const route2Data = jeepneyRoutes[routeNames[1]];
        
        const transferFare = this.calculateTransferFare(route1Data.fare, route2Data.fare);
        
        detailsDiv.innerHTML = `
            <div class="transfer-route-clean">
                <h4>Transfer Route: ${routeNames[0]} → ${routeNames[1]}</h4>
                
                <div class="transfer-leg">
                    <h5>First Jeep: ${routeNames[0]}</h5>
                    <p><strong>Fare:</strong> ${app.formatFare(route1Data.fare)}</p>
                    <div class="boarding-info primary">
                        <strong>Board:</strong> Any stop along the route
                    </div>
                </div>
                
                <div class="transfer-point-clean">
                    Transfer Point
                    <div style="font-size: 0.9em; font-weight: normal; margin-top: 5px;">
                        Switch to: ${routeNames[1]}
                    </div>
                </div>
                
                <div class="transfer-leg">
                    <h5>Second Jeep: ${routeNames[1]}</h5>
                    <p><strong>Fare:</strong> ${app.formatFare(route2Data.fare)}</p>
                    <div class="boarding-info primary">
                        <strong>Alight:</strong> At your destination
                    </div>
                </div>
                
                <div class="fare-breakdown-clean">
                    <h5>Total Fare: ${transferFare}</h5>
                    <p><strong>${routeNames[0]}:</strong> ${app.formatFare(route1Data.fare)}</p>
                    <p><strong>${routeNames[1]}:</strong> ${app.formatFare(route2Data.fare)}</p>
                </div>
            </div>
        `;
        detailsDiv.style.display = 'block';
        this.ensureProperLayout();
    }

    areRoutesCompatible(route1Name, route2Name) {
        const incompatiblePairs = {
            "Batangas - Alangilan": ["Batangas - Balagtas", "Batangas - Soro Soro","Batangas - Balete"],
            "Batangas - Balagtas": ["Batangas - Alangilan", "Batangas - Soro Soro", "Batangas - Balete"],
            "Batangas - Soro Soro": ["Batangas - Alangilan", "Batangas - Balagtas", "Batangas - Balete"],
            "Batangas - Balete": ["Batangas - Alangilan", "Batangas - Balagtas", "Batangas - Soro Soro"],
            "Batangas - Lipa": ["Batangas - Bauan"],
            "Batangas - Bauan": ["Batangas - Lipa"],
            "Batangas - Libjo/San-Isidro/Tabangao": ["Batangas - Alangilan", "Batangas - Balagtas", "Batangas - Balete"]
        };
        
        return !(incompatiblePairs[route1Name]?.includes(route2Name) || 
                incompatiblePairs[route2Name]?.includes(route1Name));
    }

    doesRouteGoTowardDestination(startCoords, endCoords, routeData) {
        try {
            const routePoints = [...routeData.waypoints, ...(routeData.secretWaypoints || [])];
            
            const startNearest = this.findNearestPointOnRoute(startCoords, routeData);
            const endNearest = this.findNearestPointOnRoute(endCoords, routeData);
            
            const startIndex = this.findPointIndexInRoute(startNearest.point, routePoints);
            const endIndex = this.findPointIndexInRoute(endNearest.point, routePoints);
            
            // Routes that go OUT of Batangas City
            const outboundRoutes = [
                "Batangas - Lipa", 
                "Batangas - Bauan", 
                "Batangas - Balete",
                "Batangas - Dagatan (Taysan)"
            ];
            
            const routeName = Object.keys(jeepneyRoutes).find(name => 
                jeepneyRoutes[name] === routeData
            );
            
            if (outboundRoutes.includes(routeName)) {
                return endIndex > startIndex;
            }
            
            return true;
            
        } catch (error) {
            console.error('Error in direction check:', error);
            return true;
        }
    }

    // ============================================
    // HELPER METHODS
    // ============================================
    findDistanceToRoute(coords, routeData) {
        const routePoints = [...routeData.waypoints, ...(routeData.secretWaypoints || [])];
        const nearest = this.findNearestPointOnRoute(coords, routeData);
        return nearest.distance;
    }

    findNearestPointOnRoute(coords, routeData) {
        const routePoints = [...routeData.waypoints, ...(routeData.secretWaypoints || [])];
        
        let nearestPoint = null;
        let minDistance = Infinity;
        
        routePoints.forEach(point => {
            const distance = this.calculateDistance(coords, point);
            if (distance < minDistance) {
                minDistance = distance;
                nearestPoint = point;
            }
        });
        
        return { point: nearestPoint, distance: minDistance };
    }

    findPointIndexInRoute(point, routePoints) {
        for (let i = 0; i < routePoints.length; i++) {
            if (routePoints[i][0] === point[0] && routePoints[i][1] === point[1]) {
                return i;
            }
        }
        return -1;
    }

    extractFare(fareString) {
        const match = fareString.match(/₱?(\d+)/);
        return match ? parseInt(match[1], 10) : 15;
    }

    async geocodeAddress(address) {
        // Check known stops first
        const matchedLandmark = this.matchWithLandmarks(address);
        if (matchedLandmark) {
            return allStops[matchedLandmark];
        }
        
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address + ', Batangas City')}&limit=1`
            );
            const data = await response.json();
            if (data.length > 0) {
                return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
            }
        } catch (error) {
            console.error('Geocoding error:', error);
        }
        
        // Default to Batangas City center
        return [13.7565, 121.0583];
    }

    matchWithLandmarks(address) {
        const cleanAddress = address.toLowerCase().trim();
        for (const landmark of Object.keys(allStops)) {
            if (landmark.toLowerCase().includes(cleanAddress) || cleanAddress.includes(landmark.toLowerCase())) {
                return landmark;
            }
        }
        return null;
    }

    ensureProperLayout() {
        const detailsDiv = document.getElementById('route-details');
        const routesList = document.getElementById('routes-list');
        const sidebar = document.getElementById('sidebar');
        
        if (detailsDiv && routesList && sidebar) {
            if (detailsDiv.parentNode === sidebar) sidebar.removeChild(detailsDiv);
            if (routesList.parentNode === sidebar) sidebar.removeChild(routesList);
            
            sidebar.appendChild(detailsDiv);
            sidebar.appendChild(routesList);
        }
    }
}

// ============================================
// INITIALIZATION AND GLOBAL ACCESS
// ============================================
const app = new BatangasJeepneySystem();
const routeManager = new RouteManager();
const routePlanner = new RoutePlanner();

// Make available globally for HTML onclick events
window.routeManager = routeManager;
window.routePlanner = routePlanner;
window.app = app;

// Utility functions
window.resetSystem = function() {
    console.log('Emergency system reset...');
    routeManager.clearAllRoutes();
    const routeOptions = document.getElementById('route-options');
    if (routeOptions) routeOptions.innerHTML = '';
    const startLocation = document.getElementById('startLocation');
    const endLocation = document.getElementById('endLocation');
    if (startLocation) startLocation.value = '';
    if (endLocation) endLocation.value = '';
    alert('System has been reset!');
};

window.clearInputsAndRoutes = function() {
    app.clearLocationAndRoutes();
}