import Foundation

struct AppConfiguration {
    let apiBaseURL: URL
    let mapStyleURL: URL

    static let current: AppConfiguration = {
        let apiString = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String
            ?? "http://127.0.0.1:8000"
        guard let apiURL = URL(string: apiString),
              let styleURL = URL(string: apiString + "/api/v1/map/style.json") else {
            fatalError("API_BASE_URL must be a valid URL")
        }
        return AppConfiguration(apiBaseURL: apiURL, mapStyleURL: styleURL)
    }()
}
