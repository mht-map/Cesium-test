'use client';

import { useEffect, useRef } from 'react';

// The URL on your server where CesiumJS's static files are hosted.
declare global {
  interface Window {
    CESIUM_BASE_URL: string;
  }
}

export default function CesiumViewer() {
  const cesiumContainerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const clientSidebarRef = useRef<HTMLDivElement>(null);
  const layerControlsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Set the base URL for CesiumJS static files
    window.CESIUM_BASE_URL = '/cesium/';
    console.log('Cesium base URL set to:', window.CESIUM_BASE_URL);

    // Import CesiumJS dynamically to avoid SSR issues
    const initCesium = async () => {
      try {
        console.log('Starting Cesium initialization...');
                 const {
           Ion,
           Viewer,
           IonResource,
           GeoJsonDataSource,
           Color,
           ColorMaterialProperty,
           ConstantProperty,
           Cartesian3,
           Cesium3DTileset,
           createWorldTerrainAsync,
           HeightReference,
           ClassificationType,
           Cesium3DTileStyle,
           ScreenSpaceEventHandler,
           ScreenSpaceEventType,
           defined,
           Cartographic,
           Math,
           ClippingPlaneCollection,
           ClippingPlane,
           Transforms,
           Matrix4
         } = await import('cesium');
       
        const CesiumMath = Math;
        console.log('Cesium modules imported successfully');
       
        // Import CSS for Cesium widgets
        await import("cesium/Build/Cesium/Widgets/widgets.css");
        console.log('Cesium CSS imported successfully');

        // Grant CesiumJS access to your ion assets
        Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIxYzFkMTRhYy00ZTIxLTQ1ZGEtODg5OC05MTFlNTk1MTgwN2MiLCJpZCI6MzI4NDM1LCJpYXQiOjE3NTQyOTE1NDB9.mQQx2MNZWX7RCmg2EU796bDczu20Wwl1Ug7PhwtvVAg";
        console.log('Cesium Ion token set successfully');

                 // Initialize the Cesium Viewer with terrain (Option 1 from advice)
         console.log('Creating Cesium viewer with terrain...');
         const terrainProvider = await createWorldTerrainAsync();
         const viewer = new Viewer(cesiumContainerRef.current!, {
           terrainProvider,
           // Disable time-related widgets
           animation: false,
           timeline: false,
         });
        console.log('Cesium viewer created successfully with terrain');

        // Set initial camera view to UK
        viewer.camera.flyTo({
          destination: Cartesian3.fromDegrees(-3.0, 54.5, 1000000), // UK center with appropriate height
        });
        console.log('Camera set to UK view');

                           // Store references to data sources and tileset for click handling
          let boundariesDataSource: any = null;
          let buildingsTileset: any = null;
          let polygonEntities: any[] = [];
          let allClientNames: Set<string> = new Set();
          let clientToPolygons: Map<string, any[]> = new Map();
          let clientToBuildings: Map<string, any[]> = new Map();
          let contextMenuHandler: any = null;
          let roofOffTileset: any = null;                // the overlay tileset for the selected building only
          let floorplanDs: any = null;                   // GeoJSON datasource for Meynell plan

        // Load GeoJSON data from Cesium Ion
        // Boundaries
        try {
          console.log('Loading Boundaries from Ion asset 3609253...');
          const resource1 = await IonResource.fromAssetId(3609253);
          const dataSource1 = await GeoJsonDataSource.load(resource1, {
            stroke: Color.BLUE,
            fill: Color.BLUE.withAlpha(0.3),
            strokeWidth: 2,
            clampToGround: false  // Disable clampToGround as advised
          });

          boundariesDataSource = dataSource1;
          polygonEntities = dataSource1.entities.values;

                     // Configure polygons with tenure-based coloring and collect client names
           dataSource1.entities.values.forEach((entity, index) => {
             if (entity.polygon) {
               // Debug: Log all available properties for the first few entities
               if (index < 3) {
                 console.log(`Entity ${index} properties:`, entity.properties);
                 // Try to get all property names
                 const propertyNames = Object.keys(entity.properties || {});
                 console.log(`Entity ${index} property names:`, propertyNames);
                 
                 // Try common property names that might contain tenure info
                 const possibleTenureProps = ['tenure', 'Tenure', 'TENURE', 'ownership', 'Ownership', 'OWNERSHIP', 'type', 'Type', 'TYPE', 'property_type', 'Property_Type'];
                 possibleTenureProps.forEach(prop => {
                   const value = entity.properties?.[prop]?.getValue();
                   if (value !== undefined) {
                     console.log(`Entity ${index} ${prop}: ${value}`);
                   }
                 });
               }

               // Extract the "tenure" property from the entity (using _Tenure with underscore)
               const tenure = entity.properties?._Tenure?.getValue();
               
               // Debug: Log the tenure value to see what we're getting (first 10 entities)
               if (index < 10) {
                 console.log(`Polygon ${index} tenure: "${tenure}" (type: ${typeof tenure})`);
               }

               // Set the fill color based on tenure (using more robust matching)
               if (tenure) {
                 const tenureLower = tenure.toString().toLowerCase().trim();
                 
                 if (tenureLower.includes('freehold')) {
                   entity.polygon.material = new ColorMaterialProperty(Color.BLUE.withAlpha(0.4));
                   if (index < 10) console.log(`Applied BLUE color for Freehold type: "${tenure}" (normalized: "${tenureLower}")`);
                 } else if (tenureLower.includes('leasehold')) {
                   entity.polygon.material = new ColorMaterialProperty(Color.GREEN.withAlpha(0.4));
                   if (index < 10) console.log(`Applied GREEN color for Leasehold type: "${tenure}" (normalized: "${tenureLower}")`);
                 } else {
                   // Default/fallback color for Other Ownership, Unregistered, NULL, and any other values
                   entity.polygon.material = new ColorMaterialProperty(Color.ORANGE.withAlpha(0.4));
                   if (index < 10) console.log(`Applied ORANGE color for other tenure types: "${tenure}" (normalized: "${tenureLower}")`);
                 }
               } else {
                 // Handle null/undefined tenure
                 entity.polygon.material = new ColorMaterialProperty(Color.ORANGE.withAlpha(0.4));
                 if (index < 10) console.log(`Applied ORANGE color for null/undefined tenure`);
               }

               // Use heightReference to clamp to terrain surface instead of fixed height
               entity.polygon.heightReference = new ConstantProperty(HeightReference.CLAMP_TO_GROUND);
               // Remove fixed height to allow terrain following
               entity.polygon.height = undefined;
               entity.polygon.extrudedHeight = undefined;
               // Disable per-position height for consistent behavior
               entity.polygon.perPositionHeight = new ConstantProperty(false);
               // Disable outline to prevent terrain draping conflicts
               entity.polygon.outline = new ConstantProperty(false);
               // Classify to terrain only - this prevents overlaying 3D buildings
               entity.polygon.classificationType = new ConstantProperty(ClassificationType.TERRAIN);

               // Extract client name from polygon properties
               const t = viewer.clock.currentTime;
               const keys = [
                 'Client Name', 'client_name', 'CLIENT_NAME', 'Client_Name',
                 'client','Client','CLIENT',
                 'organisation','Organisation','ORGANISATION',
                 'organisation_name','ORGANISATION_NAME','Organisation_Name',
                 'client_organisation','CLIENT_ORGANISATION','Client_Organisation',
                 'property_owner','PROPERTY_OWNER','Property_Owner',
                 'owner','Owner','OWNER',
                 'landlord','Landlord','LANDLORD',
                 'tenant','Tenant','TENANT',
                 'name','Name','NAME'
               ];
               
               let clientName: string | null = null;
               for (const k of keys) {
                 const v = entity.properties?.[k]?.getValue?.(t) ?? entity.properties?.getValue?.(t)?.[k];
                 if (v && typeof v === 'string' && v.length > 2 && !/^\d+$/.test(v)) {
                   clientName = String(v);
                   break;
                 }
               }

               if (clientName) {
                 allClientNames.add(clientName);
                 
                 // Store polygon reference for this client
                 if (!clientToPolygons.has(clientName)) {
                   clientToPolygons.set(clientName, []);
                 }
                 clientToPolygons.get(clientName)!.push(entity);
               }
             }
           });

          await viewer.dataSources.add(dataSource1);
         
          console.log('Boundaries (3609253) loaded successfully with blue styling and outlines disabled');

          console.log('Loading 3D Vector Tileset from Ion asset 96188...');
          
          try {
            // Load the tileset with balanced configuration for reliability
            const tileset = await Cesium3DTileset.fromIonAssetId(96188, {
              // Balanced loading parameters (less aggressive to prevent failures)
              maximumScreenSpaceError: 32, // Moderate quality to reduce load failures
              cullWithChildrenBounds: true, // Enable to reduce memory pressure
              cullRequestsWhileMoving: true, // Enable to prevent overloading during movement
              preloadWhenHidden: false, // Disable to reduce simultaneous requests
              preloadFlightDestinations: false, // Disable to reduce network load
              
              // Conservative detail loading to prevent failures
              skipLevelOfDetail: true, // Enable to skip unnecessary detail levels
              baseScreenSpaceError: 1024,
              skipScreenSpaceErrorFactor: 16,
              skipLevels: 1,
              immediatelyLoadDesiredLevelOfDetail: false,
              loadSiblings: false, // Disable to reduce simultaneous tile requests
              
              // Disable foveated rendering to simplify loading
              foveatedScreenSpaceError: false,
              
              // Enable dynamic screen space error with conservative settings
              dynamicScreenSpaceError: true,
              dynamicScreenSpaceErrorDensity: 0.00278,
              dynamicScreenSpaceErrorFactor: 2.0, // Reduced from 4.0
              dynamicScreenSpaceErrorHeightFalloff: 0.25
            });

            // Add tileset to scene
            viewer.scene.primitives.add(tileset);
          buildingsTileset = tileset;

            // Apply styling immediately
          tileset.style = new Cesium3DTileStyle({
            color: "color('red')"
          });
         
            // Set up event handlers for loading monitoring
            let loadedTiles = 0;
            
            tileset.tileLoad.addEventListener((tile: any) => {
              loadedTiles++;
              console.log(`Tile loaded: ${loadedTiles} - ${tile.contentBoundingVolume ? 'with content' : 'empty'}`);
            });

            tileset.loadProgress.addEventListener((numberOfPendingRequests: number, numberOfTilesProcessing: number) => {
              if (numberOfPendingRequests === 0 && numberOfTilesProcessing === 0) {
                console.log(`All tiles loaded! Total: ${loadedTiles} tiles`);
              } else {
                console.log(`Loading progress: ${numberOfPendingRequests} pending, ${numberOfTilesProcessing} processing, ${loadedTiles} loaded`);
              }
            });

            let failedTileCount = 0;
            let lastRetryTime = 0;
            
            tileset.tileFailed.addEventListener((error: any) => {
              failedTileCount++;
              const now = Date.now();
              
              console.error('Tile failed to load:', {
                error: error,
                errorMessage: error?.message || 'No error message',
                errorStack: error?.stack || 'No stack trace',
                errorType: typeof error,
                errorKeys: Object.keys(error || {}),
                failureCount: failedTileCount,
                timestamp: new Date().toISOString()
              });
              
              // Log additional tileset state information
              console.warn('Tileset state during failure:', {
                show: tileset.show,
                maximumScreenSpaceError: tileset.maximumScreenSpaceError,
                totalMemoryUsageInBytes: (tileset as any).totalMemoryUsageInBytes || 'unknown',
                numberOfTilesLoaded: (tileset as any).numberOfTilesLoaded || 'unknown',
                url: (tileset as any).url || 'Ion Asset 96188'
              });
              
              // Implement retry mechanism for failed tiles
              if (failedTileCount > 5 && now - lastRetryTime > 5000) { // Retry if many failures and 5s since last retry
                lastRetryTime = now;
                console.log('Multiple tile failures detected, attempting recovery...');
                
                // Temporarily increase screen space error to reduce load
                const originalError = tileset.maximumScreenSpaceError;
                tileset.maximumScreenSpaceError = (originalError * 2 < 64) ? originalError * 2 : 64;
                
                // Reset after a delay
                setTimeout(() => {
                  tileset.maximumScreenSpaceError = originalError;
                  failedTileCount = 0; // Reset failure count
                  console.log('Tile loading recovery attempt complete');
                }, 3000);
              }
            });

            // Monitor when all tiles are loaded
            tileset.allTilesLoaded.addEventListener(() => {
              console.log('All initially visible tiles have been loaded');
            });

            console.log('3D Vector Tileset (96188) loading initiated with enhanced configuration');
            
          } catch (error) {
            console.error('Failed to load 3D Vector Tileset from Ion asset 96188:', error);
            // Attempt fallback loading with minimal configuration
            try {
              console.log('Attempting fallback loading with basic configuration...');
              const fallbackTileset = await Cesium3DTileset.fromIonAssetId(96188);
              viewer.scene.primitives.add(fallbackTileset);
              buildingsTileset = fallbackTileset;
              
              fallbackTileset.style = new Cesium3DTileStyle({
                color: "color('red')"
              });
              
              console.log('Fallback 3D Vector Tileset loaded successfully');
            } catch (fallbackError) {
              console.error('Both primary and fallback tileset loading failed:', fallbackError);
            }
          }

          // Add camera movement handler to force load all tiles when camera stops
          let cameraStoppedTimeout: NodeJS.Timeout | null = null;
          viewer.camera.moveEnd.addEventListener(() => {
            // Clear any existing timeout
            if (cameraStoppedTimeout) {
              clearTimeout(cameraStoppedTimeout);
            }
            
            // Set a timeout to gently improve tile loading after camera stops moving
            cameraStoppedTimeout = setTimeout(() => {
              if (buildingsTileset) {
                console.log('Camera stopped - gently improving tile loading for current view');
                
                // Gently reduce screen space error for better detail (less aggressive)
                const currentError = buildingsTileset.maximumScreenSpaceError;
                const improvedError = (currentError * 0.5 > 8) ? currentError * 0.5 : 8; // Don't go below 8
                buildingsTileset.maximumScreenSpaceError = improvedError;
                
                // Reset to normal after a reasonable delay
                setTimeout(() => {
                  if (buildingsTileset) {
                    buildingsTileset.maximumScreenSpaceError = currentError; // Back to original
                    console.log('Gentle tile loading improvement complete');
                  }
                }, 3000); // Longer delay to allow proper loading
              }
            }, 1000); // Wait longer (1s) after camera stops moving
          });

          // Force an initial render to start tile loading
          setTimeout(() => {
            if (buildingsTileset) {
              console.log('Forcing initial tile loading...');
              viewer.scene.requestRender();
            }
          }, 1000);

          // Function to gently improve tile loading in current view
          function forceLoadTilesInView() {
            if (buildingsTileset) {
              console.log('Gently improving tile loading for current camera view...');
              
              // Gently reduce screen space error for better detail
              const originalError = buildingsTileset.maximumScreenSpaceError;
              const improvedError = (originalError * 0.25 > 4) ? originalError * 0.25 : 4; // Don't go below 4
              buildingsTileset.maximumScreenSpaceError = improvedError;
              
              // Request a few renders to ensure tiles are processed
              for (let i = 0; i < 3; i++) {
                setTimeout(() => viewer.scene.requestRender(), i * 200);
              }
              
              // Reset to original error after reasonable loading time
              setTimeout(() => {
                if (buildingsTileset) {
                  buildingsTileset.maximumScreenSpaceError = originalError;
                  console.log('Gentle tile loading improvement complete, reset to normal quality');
                }
              }, 2000); // Longer timeout for proper loading
            }
          }

          // Expose function globally for debugging
          (window as any).forceLoadTiles = forceLoadTilesInView;
          
          // Add tileset diagnostic function
          (window as any).getTilesetInfo = () => {
            if (buildingsTileset) {
              return {
                show: buildingsTileset.show,
                maximumScreenSpaceError: buildingsTileset.maximumScreenSpaceError,
                totalMemoryUsageInBytes: (buildingsTileset as any).totalMemoryUsageInBytes,
                tilesLoaded: (buildingsTileset as any).tilesLoaded,
                statistics: (buildingsTileset as any).statistics,
                url: (buildingsTileset as any).url || 'Ion Asset 96188',
                root: (buildingsTileset as any).root ? 'Available' : 'Not available'
              };
            }
            return 'Tileset not available';
          };

          console.log('Tileset debugging functions available:');
          console.log('- window.forceLoadTiles() - Manually improve tile loading');
          console.log('- window.getTilesetInfo() - Get current tileset status');

          // Setup Layer Controls
          function setupLayerControls() {
            if (layerControlsRef.current && boundariesDataSource && buildingsTileset) {
              const layerControls = layerControlsRef.current;
              
              layerControls.innerHTML = `
                <div style="
                  background: white;
                  border-radius: 6px;
                  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
                  border: 1px solid rgba(0, 0, 0, 0.08);
                  padding: 12px;
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  font-size: 13px;
                  color: #374151;
                  width: 160px;
                  backdrop-filter: blur(8px);
                ">
                  <div style="
                    font-weight: 600;
                    margin-bottom: 10px;
                    color: #1f2937;
                    font-size: 14px;
                    letter-spacing: -0.025em;
                  ">
                    Layer Selection
                  </div>
                  
                  <div style="display: flex; flex-direction: column; gap: 8px;">
                    <!-- Boundaries Toggle -->
                    <label style="
                      display: flex;
                      align-items: center;
                      gap: 8px;
                      cursor: pointer;
                      padding: 4px 6px;
                      border-radius: 4px;
                      transition: all 0.15s ease;
                    " onmouseover="this.style.backgroundColor='#f3f4f6'" onmouseout="this.style.backgroundColor='transparent'">
                      <input 
                        type="checkbox" 
                        id="boundariesToggle"
                        checked 
                        style="
                          width: 14px;
                          height: 14px;
                          accent-color: #3b82f6;
                          cursor: pointer;
                          margin: 0;
                        "
                      />
                      <span style="
                        font-weight: 500;
                        font-size: 13px;
                        color: #374151;
                        user-select: none;
                      ">Boundaries</span>
                    </label>
                    
                    <!-- Buildings Toggle -->
                    <label style="
                      display: flex;
                      align-items: center;
                      gap: 8px;
                      cursor: pointer;
                      padding: 4px 6px;
                      border-radius: 4px;
                      transition: all 0.15s ease;
                    " onmouseover="this.style.backgroundColor='#f3f4f6'" onmouseout="this.style.backgroundColor='transparent'">
                      <input 
                        type="checkbox" 
                        id="buildingsToggle"
                        checked 
                        style="
                          width: 14px;
                          height: 14px;
                          accent-color: #ef4444;
                          cursor: pointer;
                          margin: 0;
                        "
                      />
                      <span style="
                        font-weight: 500;
                        font-size: 13px;
                        color: #374151;
                        user-select: none;
                      ">Buildings</span>
                    </label>
                  </div>
                </div>
              `;
              
              // Add event listeners for the toggles
              const boundariesToggle = layerControls.querySelector('#boundariesToggle') as HTMLInputElement;
              const buildingsToggle = layerControls.querySelector('#buildingsToggle') as HTMLInputElement;
              
              if (boundariesToggle) {
                boundariesToggle.addEventListener('change', (e) => {
                  const isChecked = (e.target as HTMLInputElement).checked;
                  if (boundariesDataSource) {
                    boundariesDataSource.show = isChecked;
                    console.log(`Property boundaries ${isChecked ? 'enabled' : 'disabled'}`);
                  }
                });
              }
              
              if (buildingsToggle) {
                buildingsToggle.addEventListener('change', (e) => {
                  const isChecked = (e.target as HTMLInputElement).checked;
                  if (buildingsTileset) {
                    buildingsTileset.show = isChecked;
                    console.log(`3D buildings ${isChecked ? 'enabled' : 'disabled'}`);
                  }
                });
              }
              
              console.log('Layer controls initialized successfully');
            }
          }

          // Initialize layer controls after a short delay to ensure everything is loaded
          setTimeout(setupLayerControls, 500);

                                                 // Load Meynell floorplan (CAD as GeoJSON) from ion
              try {
                const fpRes = await IonResource.fromAssetId(3616747);
                floorplanDs = await GeoJsonDataSource.load(fpRes, {
                  clampToGround: true  // Clamp to terrain for natural ground following
                });
                                                  // DO NOT add to viewer yet - keep it completely separate until needed
                
                                  // Style + hide by default - only process polygons and polylines, ignore points
                    floorplanDs.entities.values.forEach((e: any) => {
                     if (e.polygon) {
                       e.polygon.material = new ColorMaterialProperty(Color.YELLOW.withAlpha(0.6));
                       e.polygon.outline = true;
                       e.polygon.outlineColor = Color.BLACK;
                       e.polygon.height = undefined;          // we'll set on demand
                       e.polygon.extrudedHeight = undefined;
                       e.polygon.clampToGround = true;  // Enable ground clamping for terrain following
                       e.polygon.heightReference = HeightReference.CLAMP_TO_GROUND;
                       e.show = false;
                     }
                     if (e.polyline) {
                       e.polyline.width = 3; // Make lines thicker for better visibility
                       e.polyline.material = new ColorMaterialProperty(Color.BLUE.withAlpha(0.8)); // Blue lines for better contrast
                       e.polyline.clampToGround = true;  // Enable ground clamping for terrain following
                       e.polyline.heightReference = HeightReference.CLAMP_TO_GROUND;
                       e.polyline.height = undefined; // we'll set on demand
                       e.show = false;
                     }
                     // Ignore points - they're not needed for floorplan visualization
                     if (e.point) {
                       e.show = false;
                     }
                   });

                                                             console.log('Floorplan (3616747) loaded and hidden - NOT added to viewer yet');
                 console.log('floorplan entities:',
                   floorplanDs.entities.values.length,
                   'polylines:',
                   floorplanDs.entities.values.filter((e:any)=>e.polyline).length,
                   'polygons:',
                   floorplanDs.entities.values.filter((e:any)=>e.polygon).length,
                   'points:',
                   floorplanDs.entities.values.filter((e:any)=>e.point).length,
                   '(points will be ignored)'
                 );

                // Floorplan is completely separate and will only be added to viewer when Meynell Primary School is selected
                console.log('Floorplan loaded but not visible - will be added to viewer only when Meynell Primary School is selected');
             } catch (e) {
               console.warn('Could not load floorplan 3616747', e);
             }

                         // Enhanced Drag and Drop Helper Functions for Floorplan with Position Saving
             
             // Function to save floorplan position to localStorage
             function saveFloorplanPosition(ds: any, viewer: any) {
               try {
                 const t = viewer.clock.currentTime;
                 const centroid = centroidCartesian(ds, t);
                 
                 if (centroid) {
                   const cartographic = Cartographic.fromCartesian(centroid);
                   const position = {
                     longitude: CesiumMath.toDegrees(cartographic.longitude),
                     latitude: CesiumMath.toDegrees(cartographic.latitude),
                     timestamp: Date.now()
                   };
                   
                   localStorage.setItem('floorplanPosition', JSON.stringify(position));
                   console.log('💾 Floorplan position saved:', position);
                   
                   // Show save confirmation
                   showSaveConfirmation();
                 }
               } catch (error) {
                 console.error('Failed to save floorplan position:', error);
               }
             }
             
             // Function to load saved floorplan position
             function loadSavedFloorplanPosition(): { longitude: number; latitude: number; timestamp: number } | null {
               try {
                 const saved = localStorage.getItem('floorplanPosition');
                 if (saved) {
                   const position = JSON.parse(saved);
                   console.log('📂 Loaded saved floorplan position:', position);
                   return position;
                 }
               } catch (error) {
                 console.error('Failed to load saved floorplan position:', error);
               }
               return null;
             }
             
             // Function to show save confirmation
             function showSaveConfirmation() {
               // Remove existing confirmation if any
               const existing = document.getElementById('saveConfirmation');
               if (existing) existing.remove();
               
               const confirmation = document.createElement('div');
               confirmation.id = 'saveConfirmation';
               confirmation.innerHTML = '✅ Position saved!';
               confirmation.style.cssText = `
                 position: absolute;
                 top: 50%;
                 left: 50%;
                 transform: translate(-50%, -50%);
                 background-color: #10b981;
                 color: white;
                 padding: 12px 24px;
                 border-radius: 8px;
                 font-weight: 600;
                 font-family: Arial, sans-serif;
                 font-size: 14px;
                 z-index: 2000;
                 box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                 animation: fadeInOut 2s ease-in-out;
               `;
               
               // Add CSS animation
               const style = document.createElement('style');
               style.textContent = `
                 @keyframes fadeInOut {
                   0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
                   20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                   80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                   100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
                 }
               `;
               document.head.appendChild(style);
               
               document.body.appendChild(confirmation);
               
               // Remove after animation
               setTimeout(() => {
                 if (confirmation.parentNode) {
                   confirmation.parentNode.removeChild(confirmation);
                 }
               }, 2000);
             }
             
             // Function to reset saved position
             function resetSavedPosition() {
               try {
                 localStorage.removeItem('floorplanPosition');
                 console.log('🗑️ Saved floorplan position cleared');
                 
                 // Show reset confirmation
                 const confirmation = document.createElement('div');
                 confirmation.innerHTML = '🗑️ Position reset to default!';
                 confirmation.style.cssText = `
                   position: absolute;
                   top: 50%;
                   left: 50%;
                   transform: translate(-50%, -50%);
                   background-color: #ef4444;
                   color: white;
                   padding: 12px 24px;
                   border-radius: 8px;
                   font-weight: 600;
                   font-family: Arial, sans-serif;
                   font-size: 14px;
                   z-index: 2000;
                   box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                   animation: fadeInOut 2s ease-in-out;
                 `;
                 
                 document.body.appendChild(confirmation);
                 
                 setTimeout(() => {
                   if (confirmation.parentNode) {
                     confirmation.parentNode.removeChild(confirmation);
                   }
                 }, 2000);
               } catch (error) {
                 console.error('Failed to reset saved position:', error);
               }
             }
             
             // Function to show current saved position status
             function showSavedPositionStatus() {
               const savedPosition = loadSavedFloorplanPosition();
               if (savedPosition) {
                 const status = document.createElement('div');
                 status.innerHTML = `
                   <div style="margin-bottom: 8px; font-weight: 600; color: #059669;">💾 Saved Position:</div>
                   <div style="font-size: 12px; color: #6b7280;">
                     Longitude: ${savedPosition.longitude.toFixed(6)}<br>
                     Latitude: ${savedPosition.latitude.toFixed(6)}<br>
                     Saved: ${new Date(savedPosition.timestamp).toLocaleString()}
                   </div>
                 `;
                 status.style.cssText = `
                   position: absolute;
                   top: 20px;
                   right: 20px;
                   background-color: white;
                   padding: 12px;
                   border-radius: 8px;
                   box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                   border: 1px solid #e5e7eb;
                   font-family: Arial, sans-serif;
                   font-size: 13px;
                   z-index: 1000;
                   max-width: 200px;
                 `;
                 
                 document.body.appendChild(status);
                 
                 // Remove after 5 seconds
                 setTimeout(() => {
                   if (status.parentNode) {
                     status.parentNode.removeChild(status);
                   }
                 }, 5000);
               }
             }
             
             /** Enhanced draggable handle with position saving */
             function enableDragForDataSource(ds: any, viewer: any) {
               const t = viewer.clock.currentTime;

               const anchor = centroidCartesian(ds, t) || viewer.scene.camera.positionWC.clone();
               
               // Create a more visible and user-friendly drag handle with save button
               const handle = viewer.entities.add({
                 position: anchor,
                 point: {
                   pixelSize: 16,
                   outlineWidth: 3,
                   outlineColor: Color.BLACK,
                   color: Color.ORANGE,
                   heightReference: HeightReference.CLAMP_TO_GROUND
                 },
                 label: {
                   text: '🔄 Drag to move floorplan',
                   font: '14px sans-serif',
                   pixelOffset: new ConstantProperty(new Cartesian3(0, -25, 0)),
                   backgroundColor: Color.WHITE.withAlpha(0.9),
                   backgroundPadding: new ConstantProperty(new Cartesian3(8, 4, 0)),
                   outline: true,
                   outlineColor: Color.BLACK,
                   style: 2, // FILL_AND_OUTLINE
                   heightReference: HeightReference.CLAMP_TO_GROUND
                 }
               });
               
               // Create button container for save and reset
               const buttonContainer = document.createElement('div');
               buttonContainer.id = 'floorplanButtons';
               buttonContainer.style.cssText = `
                 position: absolute;
                 bottom: 140px;
                 right: 20px;
                 z-index: 1000;
                 display: flex;
                 flex-direction: column;
                 gap: 8px;
               `;
               
               // Create save position button
               const saveButton = document.createElement('button');
               saveButton.id = 'saveFloorplanBtn';
               saveButton.innerHTML = '💾 Save Position';
               saveButton.style.cssText = `
                 padding: 10px 14px;
                 background-color: #059669;
                 color: white;
                 border: none;
                 border-radius: 6px;
                 font-weight: 600;
                 cursor: pointer;
                 transition: all 0.2s;
                 font-family: Arial, sans-serif;
                 font-size: 13px;
                 box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                 min-width: 140px;
               `;
               
               saveButton.onmouseover = () => {
                 saveButton.style.backgroundColor = '#047857';
               };
               saveButton.onmouseout = () => {
                 saveButton.style.backgroundColor = '#059669';
               };
               
               saveButton.onclick = () => {
                 saveFloorplanPosition(ds, viewer);
               };
               
               // Create reset position button
               const resetButton = document.createElement('button');
               resetButton.id = 'resetFloorplanBtn';
               resetButton.innerHTML = '🗑️ Reset to Default';
               resetButton.style.cssText = `
                 padding: 10px 14px;
                 background-color: #dc2626;
                 color: white;
                 border: none;
                 border-radius: 6px;
                 font-weight: 600;
                 cursor: pointer;
                 transition: all 0.2s;
                 font-family: Arial, sans-serif;
                 font-size: 13px;
                 box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                 min-width: 140px;
               `;
               
               resetButton.onmouseover = () => {
                 resetButton.style.backgroundColor = '#b91c1c';
               };
               resetButton.onmouseout = () => {
                 resetButton.style.backgroundColor = '#dc2626';
               };
               
               resetButton.onclick = () => {
                 resetSavedPosition();
                 // Optionally, you can also move the floorplan back to default position here
                 // by calling transportFloorplanToMeynell again
               };
               
               // Add buttons to container
               buttonContainer.appendChild(saveButton);
               buttonContainer.appendChild(resetButton);
               
               // Add button container to map container
               const mapContainer = document.getElementById('cesiumContainer');
               if (mapContainer) {
                 mapContainer.appendChild(buttonContainer);
               }

               // Add visual feedback - show the handle is draggable
               const pulseAnimation = () => {
                 if (handle.point) {
                   const currentSize = (handle.point as any).pixelSize?.getValue?.(t) || 16;
                   const newSize = currentSize === 16 ? 20 : 16;
                   (handle.point as any).pixelSize = new ConstantProperty(newSize);
                 }
               };
               const pulseInterval = setInterval(pulseAnimation, 800);

               const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
               let dragging = false;
               let dragStartWorld: any = null;
               let dsStartAnchor: any = null;

               // Enhanced drag start with visual feedback
               handler.setInputAction((evt: any) => {
                 const picked = viewer.scene.pick(evt.position);
                 if (!picked || picked.id !== handle) return;

                 dragging = true;
                 dragStartWorld = viewer.scene.pickPosition(evt.position);
                 dsStartAnchor = (handle.position as any).getValue(t);
                 
                 // Visual feedback - make handle larger and change color
                 if (handle.point) {
                   (handle.point as any).pixelSize = new ConstantProperty(24);
                   (handle.point as any).color = new ConstantProperty(Color.RED);
                 }
                 if (handle.label) {
                   (handle.label as any).text = new ConstantProperty('🔄 Moving...');
                 }
                 
                 // Stop pulsing when dragging
                 clearInterval(pulseInterval);
               }, ScreenSpaceEventType.LEFT_DOWN);

               // Smooth dragging with real-time updates
               handler.setInputAction((evt: any) => {
                 if (!dragging || !dragStartWorld || !dsStartAnchor) return;
                 const cur = viewer.scene.pickPosition(evt.endPosition);
                 if (!cur) return;

                 // world-space delta
                 const delta = Cartesian3.subtract(cur, dragStartWorld, new Cartesian3());
                 // move all entities in the dataSource by this delta
                 translateDataSourceByDelta(ds, delta, t);

                 const newAnchor = Cartesian3.add(dsStartAnchor, delta, new Cartesian3());
                 handle.position = new ConstantProperty(newAnchor);
                 viewer.scene.requestRender();
               }, ScreenSpaceEventType.MOUSE_MOVE);

               // Enhanced drag end with visual feedback and auto-save option
               handler.setInputAction(() => {
                 dragging = false;
                 
                 // Restore handle appearance
                 if (handle.point) {
                   (handle.point as any).pixelSize = new ConstantProperty(16);
                   (handle.point as any).color = new ConstantProperty(Color.ORANGE);
                 }
                 if (handle.label) {
                   (handle.label as any).text = new ConstantProperty('🔄 Drag to move floorplan');
                 }
                 
                 // Resume pulsing
                 const newPulseInterval = setInterval(pulseAnimation, 800);
                 
                 console.log('Floorplan moved successfully');
                 
                 // Auto-save after drag (optional - you can remove this if you prefer manual save only)
                 // setTimeout(() => saveFloorplanPosition(ds, viewer), 1000);
               }, ScreenSpaceEventType.LEFT_UP);

               // Enhanced keyboard controls
               window.addEventListener('keydown', (e) => {
                 if (e.key === 'Escape') {
                   clearInterval(pulseInterval);
                   handler.destroy();
                   viewer.entities.remove(handle);
                   if (buttonContainer.parentNode) buttonContainer.parentNode.removeChild(buttonContainer);
                   console.log('Drag handle and buttons removed');
                 } else if (e.key === 'h' || e.key === 'H') {
                   // Toggle handle visibility
                   if (handle.show) {
                     handle.show = new ConstantProperty(false);
                     buttonContainer.style.display = 'none';
                     console.log('Drag handle and buttons hidden (press H again to show)');
                   } else {
                     handle.show = new ConstantProperty(true);
                     buttonContainer.style.display = 'block';
                     console.log('Drag handle and buttons shown');
                   }
                 } else if (e.key === 's' || e.key === 'S') {
                   // Quick save with S key
                   saveFloorplanPosition(ds, viewer);
                 } else if (e.key === 'r' || e.key === 'R') {
                   // Quick reset with R key
                   resetSavedPosition();
                 } else if (e.key === 'i' || e.key === 'I') {
                   // Show info with I key
                   showSavedPositionStatus();
                 }
               });

               // Add helpful tooltip
               console.log('🎯 Enhanced drag handle created!');
               console.log('💡 Controls:');
               console.log('   - Click and drag the orange handle to move floorplan');
               console.log('   - Click "Save Position" button to save current location');
               console.log('   - Click "Reset to Default" button to clear saved position');
               console.log('   - Press S to quickly save position');
               console.log('   - Press R to quickly reset position');
               console.log('   - Press I to show saved position info');
               console.log('   - Press H to hide/show the handle and buttons');
               console.log('   - Press ESC to remove the handle and buttons');
               
               // Return cleanup function
               return () => {
                 clearInterval(pulseInterval);
                 handler.destroy();
                 viewer.entities.remove(handle);
                 if (buttonContainer.parentNode) buttonContainer.parentNode.removeChild(buttonContainer);
               };
             }
             
             // ---- helpers to target exactly one building ----
             function getFeatureId(feature: any): { key: string; value: string } | null {
               const candidates = ['elementId','id','osm_id','fid'];
               for (const k of candidates) {
                 const v = feature.getProperty?.(k);
                 if (v !== undefined && v !== null && v !== '') return { key: k, value: String(v) };
               }
               const names = feature.getPropertyNames?.() ?? [];
               for (const k of names) {
                 const v = feature.getProperty(k);
                 if (v !== undefined && v !== null && typeof v !== 'object') return { key: k, value: String(v) };
               }
               return null;
             }
             
             let mainOriginalStyle: any = null;
             let hiddenInMain: { key: string; value: string } | null = null;
             
             function hideSelectedInMain(tileset: any, id: {key:string;value:string}) {
               if (!mainOriginalStyle) mainOriginalStyle = tileset.style;
               tileset.style = new Cesium3DTileStyle({
                 color: "color('red')",
                 show: { conditions: [[`\${${id.key}} === '${id.value}'`, 'false'], ['true','true']] }
               });
               hiddenInMain = id;
             }
             
             function restoreMain(tileset: any) {
               tileset.style = mainOriginalStyle ?? new Cesium3DTileStyle({ color: "color('red')" });
               mainOriginalStyle = null;
               hiddenInMain = null;
             }

                         /** Translate every vertex in the datasource by a world-space delta (ECEF) */
             function translateDataSourceByDelta(ds: any, delta: any, time: any) {
               ds.entities.values.forEach((e: any) => {
                 // Polygons - handle hierarchy positions
                 if (e.polygon?.hierarchy) {
                   const h = e.polygon.hierarchy.getValue(time);
                   if (h && h.positions && Array.isArray(h.positions)) {
                     const moved = h.positions.map((p: any) => Cartesian3.add(p, delta, new Cartesian3()));
                     // Use the proper Cesium PolygonHierarchy constructor
                     const newHierarchy = { positions: moved };
                     e.polygon.hierarchy = new ConstantProperty(newHierarchy);
                   }
                 }
                 // Polylines - handle position arrays
                 if (e.polyline?.positions) {
                   const pos = e.polyline.positions.getValue(time);
                   if (Array.isArray(pos)) {
                     const moved = pos.map((p: any) => Cartesian3.add(p, delta, new Cartesian3()));
                     e.polyline.positions = new ConstantProperty(moved);
                   }
                 }
                 // Ignore points - they're not needed for floorplan visualization
                 // if (e.position) { ... }
               });
             }

                         /** Rough centroid of the datasource in world coordinates */
             function centroidCartesian(ds: any, time: any): any {
               const acc = new Cartesian3(0, 0, 0);
               let count = 0;
               ds.entities.values.forEach((e: any) => {
                 if (e.polygon?.hierarchy) {
                   e.polygon.hierarchy.getValue(time).positions.forEach((p: any) => {
                     Cartesian3.add(acc, p, acc);
                     count++;
                   });
                 } else if (e.polyline?.positions) {
                   e.polyline.positions.getValue(time).forEach((p: any) => {
                     Cartesian3.add(acc, p, acc);
                     count++;
                   });
                 }
                 // Ignore points - they're not needed for floorplan visualization
                 // else if (e.position) { ... }
               });
               if (!count) return null;
               return Cartesian3.multiplyByScalar(acc, 1 / count, new Cartesian3());
             }

                                                   /** Transport floorplan to Meynell Primary School location or saved position */
              async function transportFloorplanToMeynell(meynellCarto: any) {
                if (!floorplanDs) return;
               
                console.log('Transporting floorplan to location...');
               
                // Get current floorplan centroid
                const t = viewer.clock.currentTime;
                const currentCentroid = centroidCartesian(floorplanDs, t);
               
                if (!currentCentroid) {
                  console.warn('Could not determine current floorplan centroid');
                  return;
                }
               
                // Check if there's a saved position
                const savedPosition = loadSavedFloorplanPosition();
                let targetPosition: any;
                
                if (savedPosition) {
                  console.log('📂 Using saved floorplan position:', savedPosition);
                  targetPosition = Cartesian3.fromDegrees(
                    savedPosition.longitude,
                    savedPosition.latitude,
                    currentCentroid.z // Preserve the original Z coordinate
                  );
                } else {
                  console.log('📍 Using default Meynell location');
                  // Use default Meynell location
                  targetPosition = Cartesian3.fromDegrees(
                    CesiumMath.toDegrees(meynellCarto.longitude),
                    CesiumMath.toDegrees(meynellCarto.latitude),
                    currentCentroid.z // Preserve the original Z coordinate
                  );
                }
               
                const offset = Cartesian3.subtract(targetPosition, currentCentroid, new Cartesian3());
               
                // Move all entities in the floorplan to the target location
                translateDataSourceByDelta(floorplanDs, offset, t);
               
                if (savedPosition) {
                  console.log('Floorplan transported to saved position');
                } else {
                  console.log('Floorplan transported to Meynell location');
                }
              }

                       // Function to populate client sidebar
            function populateClientSidebar() {
              if (clientSidebarRef.current) {
                const sidebar = clientSidebarRef.current;
                const sortedClientNames = Array.from(allClientNames).sort();
               
                const clientListHtml = sortedClientNames.map(clientName => {
                  const polygonCount = clientToPolygons.get(clientName)?.length || 0;
                  const buildingCount = clientToBuildings.get(clientName)?.length || 0;
                  const totalCount = polygonCount + buildingCount;
                 
                  return `
                    <div
                      class="client-item"
                      data-client="${clientName}"
                      style="
                        padding: 12px 16px;
                        border-bottom: 1px solid #e5e7eb;
                        cursor: pointer;
                        transition: background-color 0.2s;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                      "
                      onmouseover="this.style.backgroundColor='#f3f4f6'"
                      onmouseout="this.style.backgroundColor='transparent'"
                    >
                      <div style="flex: 1;">
                        <div style="font-weight: 600; color: #1f2937; font-size: 14px; margin-bottom: 4px;">
                          ${clientName}
                        </div>
                        <div style="font-size: 12px; color: #6b7280;">
                          ${polygonCount} boundaries, ${buildingCount} buildings
                        </div>
                      </div>
                      <div style="
                        background-color: #2563eb;
                        color: white;
                        padding: 4px 8px;
                        border-radius: 12px;
                        font-size: 11px;
                        font-weight: 600;
                      ">
                        ${totalCount}
                      </div>
                    </div>
                  `;
                }).join('');

                sidebar.innerHTML = `
                  <div style="padding: 20px;">
                    <div style="display: flex; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #e5e7eb;">
                      <span style="font-size: 20px; margin-right: 12px;">👥</span>
                      <span style="font-weight: 600; font-size: 16px; text-transform: uppercase; letter-spacing: 0.5px; color: #2563eb;">Client List</span>
                    </div>
                   
                    <div style="margin-bottom: 16px;">
                      <div style="position: relative; margin-bottom: 12px;">
                        <input
                          type="text"
                          id="clientSearchInput"
                          placeholder="Search clients..."
                          style="
                            width: 100%;
                            padding: 10px 12px;
                            padding-left: 36px;
                            border: 1px solid #d1d5db;
                            border-radius: 6px;
                            font-size: 14px;
                            outline: none;
                            transition: border-color 0.2s;
                            box-sizing: border-box;
                          "
                          onfocus="this.style.borderColor='#2563eb'"
                          onblur="this.style.borderColor='#d1d5db'"
                        />
                        <span style="
                          position: absolute;
                          left: 12px;
                          top: 50%;
                          transform: translateY(-50%);
                          color: #6b7280;
                          font-size: 14px;
                        ">🔍</span>
                      </div>
                      <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">Click a client to filter</div>
                      <div style="font-size: 14px; color: #1f2937; font-weight: 600;">
                        ${sortedClientNames.length} clients found
                      </div>
                    </div>
                   
                    <div id="clientListContainer" style="max-height: calc(100vh - 280px); overflow-y: auto;">
                      ${clientListHtml}
                    </div>
                   
                    <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
                      <button
                        id="showAllBtn"
                        style="
                          width: 100%;
                          padding: 10px;
                          background-color: #10b981;
                          color: white;
                          border: none;
                          border-radius: 6px;
                          font-weight: 600;
                          cursor: pointer;
                          transition: background-color 0.2s;
                        "
                        onmouseover="this.style.backgroundColor='#059669'"
                        onmouseout="this.style.backgroundColor='#10b981'"
                      >
                        Show All Assets
                      </button>
                    </div>
                  </div>
                `;

                               // Add search functionality
                const searchInput = sidebar.querySelector('#clientSearchInput') as HTMLInputElement;
                if (searchInput) {
                  searchInput.addEventListener('input', (e) => {
                    const searchTerm = (e.target as HTMLInputElement).value.toLowerCase().trim();
                    const clientItems = sidebar.querySelectorAll('.client-item');
                    const clientListContainer = sidebar.querySelector('#clientListContainer') as HTMLElement;
                   
                    let firstMatch: HTMLElement | null = null;
                    let visibleCount = 0;
                   
                                         clientItems.forEach((item, index) => {
                       const clientName = (item as HTMLElement).dataset.client || '';
                       const isMatch = clientName.toLowerCase().includes(searchTerm);
                       
                       if (isMatch) {
                         (item as HTMLElement).style.display = 'flex';
                         visibleCount++;
                         
                         // Remove yellow highlighting, just show as normal
                         (item as HTMLElement).style.backgroundColor = 'transparent';
                         (item as HTMLElement).style.borderLeft = 'none';
                         
                         // Store first match for scrolling
                         if (!firstMatch) {
                           firstMatch = item as HTMLElement;
                         }
                       } else {
                         // Keep all items visible but make non-matches more transparent
                         (item as HTMLElement).style.display = 'flex';
                         (item as HTMLElement).style.backgroundColor = 'transparent';
                         (item as HTMLElement).style.borderLeft = 'none';
                         (item as HTMLElement).style.opacity = '0.3';
                       }
                     });
                     
                     // Scroll to first match if found and scroll to top
                     if (firstMatch && searchTerm.length > 0) {
                       (firstMatch as HTMLElement).scrollIntoView({
                         behavior: 'smooth',
                         block: 'start'
                       });
                     }
                   
                                         // Update the count display
                     const countDisplay = sidebar.querySelector('div[style*="font-weight: 600"]') as HTMLElement;
                     if (countDisplay) {
                       if (searchTerm.length > 0) {
                         countDisplay.textContent = `${visibleCount} of ${sortedClientNames.length} clients found`;
                       } else {
                         countDisplay.textContent = `${sortedClientNames.length} clients found`;
                         // Reset all items to normal display when search is cleared
                         clientItems.forEach((item) => {
                           (item as HTMLElement).style.opacity = '1';
                           (item as HTMLElement).style.backgroundColor = 'transparent';
                           (item as HTMLElement).style.borderLeft = 'none';
                         });
                       }
                     }
                  });
                 
                  // Add Enter key handler to select the first matching client
                  searchInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                      const firstMatchingItem = sidebar.querySelector('.client-item') as HTMLElement;
                      if (firstMatchingItem) {
                        const clientName = firstMatchingItem.dataset.client;
                        if (clientName) {
                          filterByClient(clientName);
                          // Clear search and reset display
                          searchInput.value = '';
                          searchInput.dispatchEvent(new Event('input'));
                        }
                      }
                    }
                  });
                }

                // Add click handlers for client items
                const clientItems = sidebar.querySelectorAll('.client-item');
                clientItems.forEach(item => {
                  item.addEventListener('click', () => {
                    const clientName = (item as HTMLElement).dataset.client;
                    if (clientName) {
                      filterByClient(clientName);
                    }
                  });
                });

                // Add click handler for "Show All" button
                const showAllBtn = sidebar.querySelector('#showAllBtn');
                if (showAllBtn) {
                  showAllBtn.addEventListener('click', () => {
                    showAllAssets();
                  });
                }
             }
           }

                       // Function to filter assets by client
            function filterByClient(clientName: string) {
              console.log(`Filtering by client: ${clientName}`);
             
              // Hide all polygons first
              polygonEntities.forEach(entity => {
                if (entity.polygon) {
                  entity.polygon.show = new ConstantProperty(false);
                }
              });
             
              // Show only polygons for this client
              const clientPolygons = clientToPolygons.get(clientName) || [];
              clientPolygons.forEach(entity => {
                if (entity.polygon) {
                  entity.polygon.show = new ConstantProperty(true);
                }
              });
             
              // Pan to the client's boundaries
              if (clientPolygons.length > 0) {
                panToClientBoundaries(clientPolygons);
              }
             
              // For 3D buildings, we'll need to check which ones are within the client's polygons
              // This is more complex, so for now we'll show all buildings
              // In a full implementation, you'd want to pre-calculate which buildings belong to which clients
             
                             // Update the sidebar to show which client is selected and scroll to top
               if (clientSidebarRef.current) {
                 const clientItems = clientSidebarRef.current.querySelectorAll('.client-item');
                 let selectedItem: HTMLElement | null = null;
                 
                 clientItems.forEach(item => {
                   const itemClientName = (item as HTMLElement).dataset.client;
                   if (itemClientName === clientName) {
                     selectedItem = item as HTMLElement;
                     (item as HTMLElement).style.backgroundColor = '#dbeafe';
                     (item as HTMLElement).style.borderLeft = '4px solid #2563eb';
                   } else {
                     (item as HTMLElement).style.backgroundColor = 'transparent';
                     (item as HTMLElement).style.borderLeft = 'none';
                   }
                 });
                 
                 // Scroll the selected client to the top of the list
                 if (selectedItem) {
                   (selectedItem as HTMLElement).scrollIntoView({
                     behavior: 'smooth',
                     block: 'start'
                   });
                 }
               }
            }

            // Function to pan to client boundaries
            function panToClientBoundaries(clientPolygons: any[]) {
              console.log(`Panning to ${clientPolygons.length} boundaries for client`);
             
              const t = viewer.clock.currentTime;
              let minLon = Infinity;
              let maxLon = -Infinity;
              let minLat = Infinity;
              let maxLat = -Infinity;
              let hasValidBoundaries = false;
             
              // Calculate bounding box for all client boundaries
              clientPolygons.forEach(entity => {
                if (!entity.polygon) return;
               
                const hierarchy = entity.polygon.hierarchy?.getValue?.(t);
                if (!hierarchy || !hierarchy.positions?.length) return;
               
                hasValidBoundaries = true;
               
                // Convert all positions to lon/lat and find min/max
                hierarchy.positions.forEach((pos: any) => {
                  const cartographic = Cartographic.fromCartesian(pos);
                  const lon = CesiumMath.toDegrees(cartographic.longitude);
                  const lat = CesiumMath.toDegrees(cartographic.latitude);
                 
                  minLon = window.Math.min(minLon, lon);
                  maxLon = window.Math.max(maxLon, lon);
                  minLat = window.Math.min(minLat, lat);
                  maxLat = window.Math.max(maxLat, lat);
                });
              });
             
              if (!hasValidBoundaries) {
                console.log('No valid boundaries found for client');
                return;
              }
             
              // Calculate center and extent
              const centerLon = (minLon + maxLon) / 2;
              const centerLat = (minLat + maxLat) / 2;
              const lonExtent = maxLon - minLon;
              const latExtent = maxLat - minLat;
             
              // Add padding to the extent (20% on each side)
              const padding = 0.2;
              const paddedLonExtent = lonExtent * (1 + padding);
              const paddedLatExtent = latExtent * (1 + padding);
             
              // Calculate appropriate height based on extent
              // Larger extents need higher altitude to see everything
              const maxExtent = window.Math.max(paddedLonExtent, paddedLatExtent);
              let height = 100000; // Default height
             
              if (maxExtent > 10) {
                height = 5000000; // Very large extent
              } else if (maxExtent > 5) {
                height = 2000000; // Large extent
              } else if (maxExtent > 2) {
                height = 500000; // Medium extent
              } else if (maxExtent > 0.5) {
                height = 100000; // Small extent
              } else {
                height = 50000; // Very small extent
              }
             
              console.log(`Flying to center: ${centerLon}, ${centerLat} with height: ${height}`);
             
              // Fly to the calculated position
              viewer.camera.flyTo({
                destination: Cartesian3.fromDegrees(centerLon, centerLat, height),
                duration: 2.0, // 2 second animation
                complete: () => {
                  console.log('Finished flying to client boundaries');
                }
              });
            }

           // Function to show all assets
           function showAllAssets() {
             console.log('Showing all assets');
             
             // Show all polygons
             polygonEntities.forEach(entity => {
               if (entity.polygon) {
                 entity.polygon.show = new ConstantProperty(true);
               }
             });
             
             // Clear selection styling
             if (clientSidebarRef.current) {
               const clientItems = clientSidebarRef.current.querySelectorAll('.client-item');
               clientItems.forEach(item => {
                 (item as HTMLElement).style.backgroundColor = 'transparent';
                 (item as HTMLElement).style.borderLeft = 'none';
               });
             }
           }

                       // Populate the client sidebar
            populateClientSidebar();

            // Utility functions for floorplan management
            async function groundHeightAt(carto: any): Promise<number> {
              try {
                const cartoClone = Cartographic.clone(carto);
                const result = await viewer.scene.sampleHeightMostDetailed([cartoClone]);
                if (result && result.length > 0 && result[0] && result[0].height !== undefined && isFinite(result[0].height)) {
                  return result[0].height;
                }
              } catch {}
              const approx = viewer.scene.globe.getHeight(carto);
              return (approx ?? 0);
            }

                                                                                                       async function showFloorplanAtHeight(heightMeters: number) {
                 if (!floorplanDs) return;
  
                 const t = viewer.clock.currentTime;
  
                 floorplanDs.entities.values.forEach((e: any) => {
                   // Polygons: create thin slabs that follow the terrain
                   if (e.polygon) {
                     // Remove fixed height and use ground clamping
                     e.polygon.height = undefined;
                     e.polygon.extrudedHeight = undefined;
                     e.polygon.clampToGround = true; // Enable ground clamping
                     e.polygon.outline = true;
                     e.polygon.outlineColor = Color.BLACK;
                     e.polygon.heightReference = HeightReference.CLAMP_TO_GROUND;
                     e.show = true;
                   }
  
                   // Polylines: clamp to ground and follow terrain
                   if (e.polyline) {
                     // get current positions (Property or array)
                     const pos = e.polyline.positions?.getValue?.(t) ?? e.polyline.positions;
                     if (Array.isArray(pos) && pos.length) {
                       // Convert to 2D positions (lat/lon only) for ground clamping
                       const newPos = pos.map((p: any) => {
                         const carto = Cartographic.fromCartesian(p);
                         return Cartesian3.fromDegrees(CesiumMath.toDegrees(carto.longitude), CesiumMath.toDegrees(carto.latitude));
                       });
                       e.polyline.clampToGround = true; // Enable ground clamping
                       e.polyline.positions = new ConstantProperty(newPos);
                       e.polyline.width = e.polyline.width || 3; // Make lines thicker for better visibility
                       e.polyline.material = e.polyline.material || new ColorMaterialProperty(Color.BLUE.withAlpha(0.8));
                       e.polyline.heightReference = HeightReference.CLAMP_TO_GROUND;
                       e.show = true;
                     }
                   }
                  
                   // Ignore points - they're not needed for floorplan visualization
                   if (e.point) {
                     e.show = false;
                   }
                 });
  
                 // make sure a frame renders after edits
                 viewer.scene.requestRender();
                 
                 console.log(`Floorplan shown clamped to ground`);
               }

                         function hideFloorplan() {
               if (!floorplanDs) return;
               floorplanDs.entities.values.forEach((e: any) => {
                 // Only hide polygons and polylines, points are already hidden
                 if (e.polygon || e.polyline) {
                   e.show = false;
                 }
               });
             }

                      // Set up click event handler for 3D buildings
            const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
           
           // Add click handler to hide tooltip when clicking elsewhere
           const hideTooltipHandler = new ScreenSpaceEventHandler(viewer.scene.canvas);
         
          handler.setInputAction((event: any) => {
            console.log('=== CLICK EVENT TRIGGERED ===');

            // 1) Pick the feature
            const picked = viewer.scene.pick(event.position);
            if (!defined(picked)) {
              console.log('No object picked');
              return;
            }

            // 2) Make sure it came from *your* tileset
            // Newer Cesium returns Cesium3DTilesetFeature with .tileset; older has .content.tileset
            const pickedTileset =
              (picked as any).tileset ??
              (picked as any).content?.tileset;

            if (pickedTileset !== buildingsTileset) {
              console.log('Clicked object is not from the 3D tileset');
              return;
            }

            // 3) Get the world position of the clicked pixel
            if (!viewer.scene.pickPositionSupported) {
              console.warn('pickPosition not supported on this platform');
              return;
            }
            const worldPos = viewer.scene.pickPosition(event.position);
            if (!defined(worldPos)) {
              console.log('Could not resolve world position for picked feature');
              return;
            }

            // 4) Convert to lon/lat
            const carto = Cartographic.fromCartesian(worldPos);
            const longitude = CesiumMath.toDegrees(carto.longitude);
            const latitude = CesiumMath.toDegrees(carto.latitude);
            console.log(`Picked lon/lat: ${longitude}, ${latitude}`);

            // 5) Find containing polygon and pull a client name
            let containingPolygon: any = null;
            let clientName: string | null = null;

            // current time for time-varying properties
            const t = viewer.clock.currentTime;

            for (let i = 0; i < polygonEntities.length; i++) {
              const e = polygonEntities[i];
              if (!e.polygon) continue;

              const h = e.polygon.hierarchy?.getValue?.(t);
              if (!h || !h.positions?.length) continue;

              const ring = h.positions.map((pos: any) => {
                const c = Cartographic.fromCartesian(pos);
                return { longitude: CesiumMath.toDegrees(c.longitude), latitude: CesiumMath.toDegrees(c.latitude) };
              });

              if (isPointInPolygon(longitude, latitude, ring)) {
                containingPolygon = e;

                                 // Log all available properties to find the correct client name field
                 const allProps = e.properties?.getValue?.(t) ?? e.properties;
                 console.log('All properties on boundary:', allProps);
                 
                                   // Try common property keys. Prioritize client name fields first
                  const keys = [
                    'Client Name', 'client_name', 'CLIENT_NAME', 'Client_Name',
                    'client','Client','CLIENT',
                    'organisation','Organisation','ORGANISATION',
                    'organisation_name','ORGANISATION_NAME','Organisation_Name',
                    'client_organisation','CLIENT_ORGANISATION','Client_Organisation',
                    'property_owner','PROPERTY_OWNER','Property_Owner',
                    'owner','Owner','OWNER',
                    'landlord','Landlord','LANDLORD',
                    'tenant','Tenant','TENANT',
                    'name','Name','NAME'  // Put generic 'name' last to avoid picking up IDs
                  ];
                 
                                   // First, let's see what we're actually getting
                  for (const k of keys) {
                    const v = e.properties?.[k]?.getValue?.(t) ?? e.properties?.getValue?.(t)?.[k];
                    if (v) {
                      console.log(`Found property '${k}': ${v}`);
                      // Use it if it looks like a name (not just pure numbers)
                      if (typeof v === 'string' && v.length > 2 && !/^\d+$/.test(v)) {
                        clientName = String(v);
                        console.log(`Using client name from property '${k}': ${clientName}`);
                        break;
                      }
                    }
                  }
                 
                 // If we still don't have a client name, log all properties for debugging
                 if (!clientName) {
                   console.log('No suitable client name found. All properties:');
                   if (allProps) {
                     Object.keys(allProps).forEach(key => {
                       const value = allProps[key];
                       console.log(`  ${key}: ${value}`);
                     });
                   }
                 }
                break;
              }
            }

            // Show tooltip with client information
            if (tooltipRef.current) {
              const tooltip = tooltipRef.current;
              const client = clientName ?? '(no client name found)';
             
                             // Set tooltip content with inline styles
               tooltip.innerHTML = `
                 <div style="display: flex; align-items: center; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid rgba(0, 0, 0, 0.1);">
                   <span style="font-size: 16px; margin-right: 8px;">🏢</span>
                   <span style="font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #2563eb;">Client Name</span>
                 </div>
                 <div style="line-height: 1.4;">
                   <div style="display: flex; justify-content: center; margin-bottom: 4px;">
                     <span style="font-weight: 500; color: #1f2937; font-size: 14px; text-align: center; max-width: 200px; word-wrap: break-word;">${client}</span>
                   </div>
                 </div>
               `;
             
                             // Store the world position for the tooltip
               const tooltipWorldPosition = worldPos;
               
                               // Function to update tooltip position based on camera view
                const updateTooltipPosition = () => {
                  if (tooltipWorldPosition && tooltip.style.display !== 'none') {
                    const screenPosition = viewer.scene.cartesianToCanvasCoordinates(tooltipWorldPosition);
                    if (screenPosition) {
                      // Only update if position actually changed to reduce DOM manipulation
                      const newLeft = screenPosition.x + 10;
                      const newTop = screenPosition.y - 10;
                     
                      if (tooltip.style.left !== newLeft + 'px' || tooltip.style.top !== newTop + 'px') {
                        tooltip.style.left = newLeft + 'px';
                        tooltip.style.top = newTop + 'px';
                      }
                    }
                  }
                };
               
               // Initial position
               updateTooltipPosition();
             
              // Show tooltip with animation
              tooltip.style.display = 'block';
              tooltip.style.opacity = '0';
              tooltip.style.transform = 'translateY(10px)';
             
                             // Animate in
               setTimeout(() => {
                 tooltip.style.opacity = '1';
                 tooltip.style.transform = 'translateY(0)';
               }, 10);
               
               // Store the update function on the tooltip element for later access
               (tooltip as any).updatePosition = updateTooltipPosition;
               
                               // Add camera move event listener to update tooltip position
                const cameraMoveHandler = () => {
                  if (tooltip.style.display !== 'none') {
                    updateTooltipPosition();
                  }
                };
               
                // Remove any existing camera move listener
                if ((tooltip as any).cameraMoveHandler) {
                  viewer.camera.moveEnd.removeEventListener((tooltip as any).cameraMoveHandler);
                }
               
                // Add render loop listener for smoother updates
                const renderHandler = () => {
                  if (tooltip.style.display !== 'none') {
                    updateTooltipPosition();
                  }
                };
               
                // Remove any existing render listener
                if ((tooltip as any).renderHandler) {
                  viewer.scene.postRender.removeEventListener((tooltip as any).renderHandler);
                }
               
                // Add new render listener
                viewer.scene.postRender.addEventListener(renderHandler);
                (tooltip as any).renderHandler = renderHandler;
               
               // Tooltip will stay visible until clicked elsewhere
            }
          }, ScreenSpaceEventType.LEFT_CLICK);
         
                     // Handle clicks elsewhere to hide tooltip
           hideTooltipHandler.setInputAction((event: any) => {
             const picked = viewer.scene.pick(event.position);
             
             // If we didn't click on a building from our tileset, hide the tooltip
             if (!defined(picked) ||
                 ((picked as any).tileset !== buildingsTileset &&
                  (picked as any).content?.tileset !== buildingsTileset)) {
               
                            if (tooltipRef.current) {
                const tooltip = tooltipRef.current;
               
                                // Remove render listener
                 if ((tooltip as any).renderHandler) {
                   viewer.scene.postRender.removeEventListener((tooltip as any).renderHandler);
                   (tooltip as any).renderHandler = null;
                 }
               
                tooltip.style.opacity = '0';
                tooltip.style.transform = 'translateY(10px)';
                setTimeout(() => {
                  tooltip.style.display = 'none';
                }, 300);
              }
             }
           }, ScreenSpaceEventType.LEFT_CLICK);
           
           // Set up right-click context menu for 3D buildings
           contextMenuHandler = new ScreenSpaceEventHandler(viewer.scene.canvas);
           let selectedBuildingPosition: any = null;
           let selectedBuildingFeature: any = null;
           
           // Right-click to show context menu
           contextMenuHandler.setInputAction((event: any) => {
             const picked = viewer.scene.pick(event.position);
             if (!defined(picked)) {
               hideContextMenu();
               return;
             }
             
             // Check if right-clicked on a building from our tileset
             const pickedTileset = (picked as any).tileset ?? (picked as any).content?.tileset;
             if (pickedTileset !== buildingsTileset) {
               hideContextMenu();
               return;
             }
             
             // Store the selected building info
             selectedBuildingFeature = picked;
             selectedBuildingPosition = viewer.scene.pickPosition(event.position);
             
             if (selectedBuildingPosition) {
               showContextMenu(event.position);
             }
           }, ScreenSpaceEventType.RIGHT_CLICK);
           
           // Left-click to hide context menu
           contextMenuHandler.setInputAction(() => {
             hideContextMenu();
           }, ScreenSpaceEventType.LEFT_CLICK);
           
           // Function to show context menu
           function showContextMenu(position: any) {
             const contextMenu = document.getElementById('contextMenu');
             if (contextMenu) {
               contextMenu.style.display = 'block';
               contextMenu.style.left = position.x + 'px';
               contextMenu.style.top = position.y + 'px';
               
               // Add event listeners for the menu options
               const viewFloorplanOption = document.getElementById('viewFloorplanOption');
               if (viewFloorplanOption) {
                 viewFloorplanOption.onclick = () => {
                   view3DFloorplan();
                   hideContextMenu();
                 };
                 
                 // Add hover effects
                 viewFloorplanOption.onmouseover = () => {
                   viewFloorplanOption.style.backgroundColor = '#f3f4f6';
                 };
                 viewFloorplanOption.onmouseout = () => {
                   viewFloorplanOption.style.backgroundColor = 'transparent';
                 };
               }
             }
           }
           
           // Function to hide context menu
           function hideContextMenu() {
             const contextMenu = document.getElementById('contextMenu');
             if (contextMenu) {
               contextMenu.style.display = 'none';
             }
           }
           
                                               // Function to view 3D floorplan (bird's-eye view without roof)
             async function view3DFloorplan() {
               if (!selectedBuildingPosition || !selectedBuildingFeature) return;

               const carto = Cartographic.fromCartesian(selectedBuildingPosition);
               const lon = CesiumMath.toDegrees(carto.longitude);
               const lat = CesiumMath.toDegrees(carto.latitude);

               let buildingHeight = Number(
                 selectedBuildingFeature.getProperty?.('height') ??
                 (selectedBuildingFeature.getProperty?.('building:levels') || 0) * 3
               );
               if (!isFinite(buildingHeight) || buildingHeight <= 0) buildingHeight = 30;

               // Fly top-down
               await viewer.camera.flyTo({
                 destination: Cartesian3.fromDegrees(lon, lat, buildingHeight + 120),
                 orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 },
                 duration: 1.6
               });

               // Clean old overlay
               if (roofOffTileset) {
                 viewer.scene.primitives.remove(roofOffTileset);
                 roofOffTileset = null;
               }

               // Store the original style to restore later
               if (!(buildingsTileset as any).originalStyle) {
                 (buildingsTileset as any).originalStyle = buildingsTileset.style;
               }

               // Apply roof removal to the main building tileset
               // This makes the top portion of buildings transparent to simulate roof removal
               buildingsTileset.style = new Cesium3DTileStyle({
                 color: "color('grey', 0.6)", // Semi-transparent grey
                 show: "true"
               });

               // Is this Meynell? (tight-ish bbox)
               const isMeynell = window.Math.abs(lon - (-1.489934)) < 0.01 && window.Math.abs(lat - 53.422742) < 0.01;

               if (isMeynell) {
                 console.log('🎯 Meynell Primary School detected - adding floorplan');
                 
                                 // Add & position floorplan inside the building
                if (!viewer.dataSources.contains(floorplanDs)) await viewer.dataSources.add(floorplanDs);
                await transportFloorplanToMeynell(carto);
                
                // Show floorplan at building height so it overlays the 3D building
                await showFloorplanAtHeight(buildingHeight);
                
                enableDragForDataSource(floorplanDs, viewer);  // your drag tool
               } else {
                 console.log('🚫 Not Meynell - no floorplan shown');
                 // Make sure the floorplan is not visible for non-Meynell
                 hideFloorplan();
                 if (viewer.dataSources.contains(floorplanDs)) viewer.dataSources.remove(floorplanDs, false);
               }

               addRestoreViewButton();
             }
           
                       // Function to add restore view button
            function addRestoreViewButton() {
              // Remove existing button if any
              const existingButton = document.getElementById('restoreViewBtn');
              if (existingButton) {
                existingButton.remove();
              }
             
              // Create restore view button
              const restoreButton = document.createElement('button');
              restoreButton.id = 'restoreViewBtn';
              restoreButton.innerHTML = '🔄 Restore Normal View';
              restoreButton.style.cssText = `
                position: absolute;
                bottom: 20px;
                right: 20px;
                z-index: 1000;
                padding: 12px 16px;
                background-color: #2563eb;
                color: white;
                border: none;
                border-radius: 6px;
                font-weight: 600;
                cursor: pointer;
                transition: background-color 0.2s;
                font-family: Arial, sans-serif;
                font-size: 14px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
              `;
             
              restoreButton.onmouseover = () => {
                restoreButton.style.backgroundColor = '#1d4ed8';
              };
              restoreButton.onmouseout = () => {
                restoreButton.style.backgroundColor = '#2563eb';
              };
             
              restoreButton.onclick = () => {
                restoreNormalView();
                restoreButton.remove();
              };
             
              // Add to the map container
              const mapContainer = document.getElementById('cesiumContainer');
              if (mapContainer) {
                mapContainer.appendChild(restoreButton);
              }
            }
           
                       // Function to restore normal view
                                     function restoreNormalView() {
              console.log('Restoring normal view');

              hideFloorplan();
              if (viewer.dataSources.contains(floorplanDs)) viewer.dataSources.remove(floorplanDs, false);

              // Restore the original building tileset style
              if ((buildingsTileset as any).originalStyle) {
                buildingsTileset.style = (buildingsTileset as any).originalStyle;
                console.log('🏗️ Building tileset style restored to original');
              } else {
                // Fallback to default red style
                buildingsTileset.style = new Cesium3DTileStyle({
                  color: "color('red')"
                });
                console.log('🏗️ Building tileset style restored to default red');
              }

              viewer.scene.globe.depthTestAgainstTerrain = true;

                             // remove any drag handles and save buttons you created
               const dragHandles = viewer.entities.values.filter((e: any) =>
                 e.point && e.label && e.label.text?.getValue?.() === '🔄 Drag to move floorplan'
               );
               dragHandles.forEach(handle => viewer.entities.remove(handle));
               
               // Remove floorplan buttons if they exist
               const buttonContainer = document.getElementById('floorplanButtons');
               if (buttonContainer && buttonContainer.parentNode) {
                 buttonContainer.parentNode.removeChild(buttonContainer);
               }

              const current = viewer.camera.position.clone();
              viewer.camera.flyTo({ destination: current, orientation: { heading: 0, pitch: -0.5, roll: 0 }, duration: 1.0 });
            }

        } catch (dataError) {
          console.error('Error loading GeoJSON data:', dataError);
        }

        // Point-in-polygon test function
        function isPointInPolygon(x: number, y: number, polygon: Array<{longitude: number, latitude: number}>): boolean {
          let inside = false;
          for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            if (((polygon[i].latitude > y) !== (polygon[j].latitude > y)) &&
                (x < (polygon[j].longitude - polygon[i].longitude) * (y - polygon[i].latitude) / (polygon[j].latitude - polygon[i].latitude) + polygon[i].longitude)) {
              inside = !inside;
            }
          }
          return inside;
        }

                 // Cleanup function
         return () => {
           console.log('Cleaning up Cesium viewer...');
           
           // Clean up context menu handler
           if (contextMenuHandler) {
             contextMenuHandler.destroy();
           }
           
           if (viewer && !viewer.isDestroyed()) {
             viewer.destroy();
           }
         };
      } catch (error) {
        console.error('Error initializing CesiumJS:', error);
        console.error('Error details:', error);
      }
    };

    initCesium();
  }, []);

           return (
      <div style={{ position: 'relative', width: '100%', height: '100vh', display: 'flex' }}>
        {/* Client Sidebar */}
        <div
          ref={clientSidebarRef}
          style={{
            width: '320px',
            height: '100vh',
            backgroundColor: 'white',
            color: '#1f2937',
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            borderRight: '1px solid rgba(0, 0, 0, 0.1)',
            overflowY: 'auto',
            flexShrink: 0
          }}
        />
       
        {/* Map Container */}
        <div style={{ flex: 1, position: 'relative' }}>
          {/* Layer Controls - Positioned at top left of map */}
          <div
            ref={layerControlsRef}
            style={{
              position: 'absolute',
              top: '20px',
              left: '20px',
              zIndex: 1000,
              pointerEvents: 'auto'
            }}
          />
          <div
            ref={cesiumContainerRef}
            id="cesiumContainer"
            style={{
              width: '100%',
              height: '100vh'
            }}
          />
         
                     {/* Custom Tooltip */}
           <div
             ref={tooltipRef}
             style={{
               position: 'absolute',
               display: 'none',
               zIndex: 1000,
               backgroundColor: 'white',
               color: '#1f2937',
               padding: '12px 16px',
               borderRadius: '8px',
               fontSize: '14px',
               fontFamily: 'Arial, sans-serif',
               boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
               border: '1px solid rgba(0, 0, 0, 0.1)',
               maxWidth: '280px',
               minWidth: '200px',
               transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
               pointerEvents: 'none'
             }}
           />
           
           {/* Context Menu for 3D Buildings */}
           <div
             id="contextMenu"
             style={{
               position: 'absolute',
               display: 'none',
               zIndex: 1001,
               backgroundColor: 'white',
               color: '#1f2937',
               padding: '8px 0',
               borderRadius: '8px',
               fontSize: '14px',
               fontFamily: 'Arial, sans-serif',
               boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
               border: '1px solid rgba(0, 0, 0, 0.1)',
               minWidth: '180px',
               cursor: 'pointer'
             }}
           >
             <div
               id="viewFloorplanOption"
               style={{
                 padding: '12px 16px',
                 transition: 'background-color 0.2s',
                 display: 'flex',
                 alignItems: 'center',
                 gap: '8px'
               }}
             >
               <span style={{ fontSize: '16px' }}>🏗️</span>
               <span>View 3D Floorplan</span>
             </div>
           </div>
        </div>
      </div>
    );
}