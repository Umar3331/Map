import SwiftUI

struct ContentView: View {
    var body: some View {
        MapView(styleURL: AppConfiguration.current.mapStyleURL)
            .ignoresSafeArea()
    }
}
