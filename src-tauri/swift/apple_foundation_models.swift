import Foundation
#if canImport(FoundationModels)
import FoundationModels
#endif

// Availability status codes shared with Rust (src-tauri/src/apple_fm.rs)
// 0 = available
// 1 = unsupported_os (macOS < 26.0)
// 2 = device_not_eligible
// 3 = apple_intelligence_not_enabled
// 4 = model_not_ready
// 5 = unavailable (SDK missing or other reason)

private final class ActiveTaskRegistry: @unchecked Sendable {
    static let shared = ActiveTaskRegistry()
    private let lock = NSLock()
    private var tasks: [String: Task<Void, Never>] = [:]

    func set(id: String, task: Task<Void, Never>) {
        guard !id.isEmpty else { return }
        lock.lock()
        tasks[id] = task
        lock.unlock()
    }

    func remove(id: String) {
        guard !id.isEmpty else { return }
        lock.lock()
        tasks.removeValue(forKey: id)
        lock.unlock()
    }

    func cancel(id: String) -> Bool {
        guard !id.isEmpty else { return false }
        lock.lock()
        let task = tasks.removeValue(forKey: id)
        lock.unlock()
        if let task {
            task.cancel()
            return true
        }
        return false
    }
}

private final class ResultBox: @unchecked Sendable {
    let lock = NSLock()
    var status: Int32 = 1
    var text: String? = nil
    var error: String? = nil

    func setSuccess(_ value: String) {
        lock.lock()
        status = 0
        text = value
        error = nil
        lock.unlock()
    }

    func setError(_ message: String) {
        lock.lock()
        status = 1
        text = nil
        error = message
        lock.unlock()
    }

    func setCancelled() {
        lock.lock()
        status = 2
        text = nil
        error = nil
        lock.unlock()
    }
}

private struct SendableProgressBridge: @unchecked Sendable {
    let callback: (@convention(c) (UnsafeMutableRawPointer?, UnsafePointer<CChar>) -> Void)?
    let context: UnsafeMutableRawPointer?

    func emit(_ message: String) {
        guard let callback else { return }
        message.withCString { ptr in
            callback(context, ptr)
        }
    }
}

private func allocCString(_ string: String) -> UnsafeMutablePointer<CChar>? {
    return strdup(string)
}

@_cdecl("afm_free_string")
public func afm_free_string(_ ptr: UnsafeMutablePointer<CChar>?) {
    if let ptr {
        free(ptr)
    }
}

@_cdecl("afm_is_compiled_with_sdk")
public func afm_is_compiled_with_sdk() -> Int32 {
#if canImport(FoundationModels)
    return 1
#else
    return 0
#endif
}

@_cdecl("afm_check_availability")
public func afm_check_availability() -> Int32 {
#if canImport(FoundationModels)
    if #available(macOS 26.0, *) {
        switch SystemLanguageModel.default.availability {
        case .available:
            return 0
        case .unavailable(let reason):
            switch reason {
            case .deviceNotEligible:
                return 2
            case .appleIntelligenceNotEnabled:
                return 3
            case .modelNotReady:
                return 4
            @unknown default:
                return 5
            }
        @unknown default:
            return 5
        }
    } else {
        return 1
    }
#else
    return 5
#endif
}

@_cdecl("afm_cancel")
public func afm_cancel(_ requestIdPtr: UnsafePointer<CChar>?) -> Int32 {
    guard let requestIdPtr else { return 0 }
    let requestId = String(cString: requestIdPtr)
    return ActiveTaskRegistry.shared.cancel(id: requestId) ? 1 : 0
}

@_cdecl("afm_generate")
public func afm_generate(
    _ requestIdPtr: UnsafePointer<CChar>?,
    _ systemPromptPtr: UnsafePointer<CChar>?,
    _ promptPtr: UnsafePointer<CChar>?,
    _ permissiveGuardrails: Int32,
    _ progressCb: (@convention(c) (UnsafeMutableRawPointer?, UnsafePointer<CChar>) -> Void)?,
    _ progressCtx: UnsafeMutableRawPointer?,
    _ outText: UnsafeMutablePointer<UnsafeMutablePointer<CChar>?>?,
    _ outError: UnsafeMutablePointer<UnsafeMutablePointer<CChar>?>?
) -> Int32 {
    outText?.pointee = nil
    outError?.pointee = nil

#if canImport(FoundationModels)
    guard #available(macOS 26.0, *) else {
        outError?.pointee = allocCString("Apple Foundation Models requires macOS 26 or later.")
        return 1
    }

    guard let promptPtr else {
        outError?.pointee = allocCString("Prompt is empty.")
        return 1
    }

    let requestId = requestIdPtr.map { String(cString: $0) } ?? ""
    let systemPrompt = systemPromptPtr.map { String(cString: $0) }?.trimmingCharacters(in: .whitespacesAndNewlines)
    let prompt = String(cString: promptPtr)
    let usePermissive = permissiveGuardrails != 0
    let bridge = SendableProgressBridge(callback: progressCb, context: progressCtx)

    let model: SystemLanguageModel = usePermissive
        ? SystemLanguageModel(useCase: .general, guardrails: .permissiveContentTransformations)
        : SystemLanguageModel.default

    switch model.availability {
    case .available:
        break
    case .unavailable(.deviceNotEligible):
        outError?.pointee = allocCString("This Mac is not eligible for Apple Intelligence (requires Apple Silicon).")
        return 1
    case .unavailable(.appleIntelligenceNotEnabled):
        outError?.pointee = allocCString("Apple Intelligence is turned off. Enable it in System Settings > Apple Intelligence & Siri.")
        return 1
    case .unavailable(.modelNotReady):
        outError?.pointee = allocCString("Apple Intelligence on-device model is downloading or preparing. Please wait a moment and try again.")
        return 1
    case .unavailable:
        outError?.pointee = allocCString("Apple Foundation Models is currently unavailable on this Mac.")
        return 1
    @unknown default:
        outError?.pointee = allocCString("Apple Foundation Models is currently unavailable on this Mac.")
        return 1
    }

    let semaphore = DispatchSemaphore(value: 0)
    let box = ResultBox()

    let task = Task {
        defer {
            ActiveTaskRegistry.shared.remove(id: requestId)
            semaphore.signal()
        }

        do {
            if Task.isCancelled {
                box.setCancelled()
                return
            }

            let instructionsArg: String? = (systemPrompt?.isEmpty == false) ? systemPrompt : nil
            let session = LanguageModelSession(model: model, instructions: instructionsArg)

            let stream = session.streamResponse(to: prompt)
            var latestText = ""
            var lastEmitTime = Date.distantPast

            for try await snapshot in stream {
                if Task.isCancelled {
                    box.setCancelled()
                    return
                }
                latestText = snapshot.content
                let now = Date()
                if !latestText.isEmpty && now.timeIntervalSince(lastEmitTime) >= 0.25 {
                    lastEmitTime = now
                    let preview = String(latestText.suffix(160)).replacingOccurrences(of: "\n", with: " ")
                    bridge.emit(preview)
                }
            }

            if Task.isCancelled {
                box.setCancelled()
                return
            }

            let trimmed = latestText.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty {
                box.setError("Apple Foundation Models returned an empty response.")
            } else {
                box.setSuccess(latestText)
            }
        } catch is CancellationError {
            box.setCancelled()
        } catch {
            if Task.isCancelled {
                box.setCancelled()
            } else {
                let rawDesc = error.localizedDescription
                let lower = rawDesc.lowercased()
                if lower.contains("context") || lower.contains("token") || lower.contains("window") {
                    box.setError("Apple Foundation Models context limit exceeded (~4,096 tokens). Try shortening the prompt or disabling document/folder context sharing. (\(rawDesc))")
                } else {
                    box.setError("Apple Foundation Models error: \(rawDesc)")
                }
            }
        }
    }

    ActiveTaskRegistry.shared.set(id: requestId, task: task)
    semaphore.wait()

    box.lock.lock()
    let status = box.status
    let text = box.text
    let err = box.error
    box.lock.unlock()

    if let text {
        outText?.pointee = allocCString(text)
    }
    if let err {
        outError?.pointee = allocCString(err)
    }
    return status
#else
    outError?.pointee = allocCString("Apple Foundation Models support was not included in this build (requires macOS 26 SDK).")
    return 1
#endif
}
