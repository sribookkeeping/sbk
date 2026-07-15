import SwiftUI
import PhotosUI
#if os(iOS)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

// MARK: - Small display helpers

struct AvatarView: View {
    let emoji: String
    let isParent: Bool
    var size: CGFloat = 36

    var body: some View {
        ZStack {
            Circle()
                .fill(isParent ? Color.indigo.opacity(0.18) : Color.orange.opacity(0.22))
            Text(emoji)
                .font(.system(size: size * 0.52))
        }
        .frame(width: size, height: size)
    }
}

struct StatusBadge: View {
    let text: String
    let color: Color

    var body: some View {
        Text(text)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(color.opacity(0.15), in: Capsule())
            .foregroundStyle(color)
    }
}

extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}

extension View {
    @ViewBuilder
    func decimalKeyboard() -> some View {
        #if os(iOS)
        keyboardType(.decimalPad)
        #else
        self
        #endif
    }
}

/// Parses "12.50" / "$12.50" into cents.
func parseCents(_ input: String) -> Int? {
    let cleaned = input.replacingOccurrences(of: "$", with: "").trimmed
    guard let value = Decimal(string: cleaned), value > 0 else { return nil }
    return NSDecimalNumber(decimal: value * 100).intValue
}

// MARK: - Async error handling

/// Runs an async API call and surfaces failures via a binding.
func perform(_ errorMessage: Binding<String?>, _ work: @escaping () async throws -> Void) {
    Task {
        do {
            try await work()
        } catch {
            errorMessage.wrappedValue = error.localizedDescription
        }
    }
}

struct ErrorText: View {
    let message: String?

    var body: some View {
        if let message {
            Text(message)
                .font(.footnote)
                .foregroundStyle(.red)
        }
    }
}

// MARK: - Auth-gated remote image (receipts, proof photos)

struct AuthorizedImage: View {
    let path: String
    @State private var data: Data?

    var body: some View {
        Group {
            #if os(iOS)
            if let data, let image = UIImage(data: data) {
                Image(uiImage: image).resizable().scaledToFit()
            } else {
                ProgressView()
            }
            #else
            if let data, let image = NSImage(data: data) {
                Image(nsImage: image).resizable().scaledToFit()
            } else {
                ProgressView()
            }
            #endif
        }
        .task { data = try? await API.shared.authorizedData(path) }
    }
}

// MARK: - Photo capture (camera on iOS + library everywhere)

struct PhotoField: View {
    let label: String
    @Binding var imageData: Data?
    @State private var photoItem: PhotosPickerItem?
    #if os(iOS)
    @State private var showCamera = false
    #endif

    var body: some View {
        Section(label) {
            if let imageData {
                #if os(iOS)
                if let image = UIImage(data: imageData) {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFit()
                        .frame(maxHeight: 180)
                }
                #endif
                Button("Remove photo", role: .destructive) {
                    self.imageData = nil
                    self.photoItem = nil
                }
            } else {
                #if os(iOS)
                if UIImagePickerController.isSourceTypeAvailable(.camera) {
                    Button {
                        showCamera = true
                    } label: {
                        Label("Take Photo", systemImage: "camera.fill")
                    }
                }
                #endif
                PhotosPicker(selection: $photoItem, matching: .images) {
                    Label("Choose from Library", systemImage: "photo.on.rectangle")
                }
            }
        }
        .onChange(of: photoItem) { _, newItem in
            guard let newItem else { return }
            Task {
                if let data = try? await newItem.loadTransferable(type: Data.self) {
                    imageData = data
                }
            }
        }
        #if os(iOS)
        .sheet(isPresented: $showCamera) {
            CameraPicker(imageData: $imageData)
        }
        #endif
    }
}

#if os(iOS)
struct CameraPicker: UIViewControllerRepresentable {
    @Binding var imageData: Data?
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraPicker
        init(_ parent: CameraPicker) { self.parent = parent }

        func imagePickerController(
            _ picker: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
        ) {
            if let image = info[.originalImage] as? UIImage {
                parent.imageData = image.jpegData(compressionQuality: 0.7)
            }
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }
    }
}
#endif
