import MapLibre
import SwiftUI

struct MapView: UIViewRepresentable {
    let styleURL: URL

    func makeUIView(context: Context) -> MLNMapView {
        let map = MLNMapView(frame: .zero, styleURL: styleURL)
        map.setCenter(
            CLLocationCoordinate2D(latitude: 54.6872, longitude: 25.2797),
            zoomLevel: 10,
            animated: false
        )
        map.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        map.logoView.isHidden = false
        map.attributionButton.isHidden = false
        return map
    }

    func updateUIView(_ uiView: MLNMapView, context: Context) {}
}
