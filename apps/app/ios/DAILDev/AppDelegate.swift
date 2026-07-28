import UIKit
import WebKit

@UIApplicationMain
public final class AppDelegate: UIResponder, UIApplicationDelegate {
  public var window: UIWindow?

  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let window = UIWindow(frame: UIScreen.main.bounds)
    window.rootViewController = DAILTabBarController()
    window.makeKeyAndVisible()
    self.window = window
    return true
  }
}

private final class DAILTabBarController: UITabBarController {
  #if DEBUG
  private static let baseURL = URL(string: "https://develop.157-90-26-205.sslip.io")!
  #else
  private static let baseURL = URL(string: "https://dail.157-90-26-205.sslip.io")!
  #endif

  override func viewDidLoad() {
    super.viewDidLoad()

    view.backgroundColor = UIColor(red: 0.969, green: 0.980, blue: 0.973, alpha: 1)
    tabBar.tintColor = UIColor(red: 0.094, green: 0.451, blue: 0.329, alpha: 1)
    tabBar.unselectedItemTintColor = UIColor(red: 0.467, green: 0.518, blue: 0.494, alpha: 1)
    tabBar.backgroundColor = .white
    tabBar.isTranslucent = false

    viewControllers = [
      makeTab(path: "/", title: "센터 찾기", symbol: "map", selectedSymbol: "map.fill"),
      makeTab(path: "/register/", title: "센터 등록", symbol: "plus.circle", selectedSymbol: "plus.circle.fill"),
      makeTab(path: "/?login=1", title: "내 정보", symbol: "person.crop.circle", selectedSymbol: "person.crop.circle.fill"),
    ]
  }

  private func makeTab(path: String, title: String, symbol: String, selectedSymbol: String) -> UIViewController {
    let url = URL(string: path, relativeTo: Self.baseURL)!.absoluteURL
    let controller = DAILWebViewController(url: url)
    controller.tabBarItem = UITabBarItem(
      title: title,
      image: UIImage(systemName: symbol),
      selectedImage: UIImage(systemName: selectedSymbol)
    )
    return controller
  }
}

private final class DAILWebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
  private let initialURL: URL

  private lazy var webView: WKWebView = {
    let configuration = WKWebViewConfiguration()
    configuration.websiteDataStore = .default()
    configuration.allowsInlineMediaPlayback = true
    configuration.applicationNameForUserAgent = "DAIL-iOS"
    configuration.userContentController.addUserScript(
      WKUserScript(
        source: """
          (() => {
            const contain = () => {
              const root = document.documentElement;
              if (root) {
                root.style.width = '100%';
                root.style.maxWidth = '100%';
                root.style.overflowX = 'hidden';
              }
              if (document.body) {
                document.body.style.width = '100%';
                document.body.style.maxWidth = '100%';
                document.body.style.overflowX = 'hidden';
              }
            };
            contain();
            document.addEventListener('DOMContentLoaded', contain, { once: true });
          })();
        """,
        injectionTime: .atDocumentStart,
        forMainFrameOnly: true
      )
    )

    let view = WKWebView(frame: .zero, configuration: configuration)
    view.translatesAutoresizingMaskIntoConstraints = false
    view.navigationDelegate = self
    view.uiDelegate = self
    view.allowsBackForwardNavigationGestures = true
    view.scrollView.contentInsetAdjustmentBehavior = .automatic
    view.scrollView.alwaysBounceHorizontal = false
    view.scrollView.showsHorizontalScrollIndicator = false
    view.scrollView.isDirectionalLockEnabled = true
    view.backgroundColor = UIColor(red: 0.969, green: 0.980, blue: 0.973, alpha: 1)
    view.isOpaque = false
    return view
  }()

  private let loadingView: UIView = {
    let view = UIView()
    view.translatesAutoresizingMaskIntoConstraints = false
    view.backgroundColor = UIColor(red: 0.969, green: 0.980, blue: 0.973, alpha: 1)
    return view
  }()

  private let spinner: UIActivityIndicatorView = {
    let spinner = UIActivityIndicatorView(style: .large)
    spinner.translatesAutoresizingMaskIntoConstraints = false
    spinner.color = UIColor(red: 0.184, green: 0.608, blue: 0.463, alpha: 1)
    return spinner
  }()

  private let loadingLabel: UILabel = {
    let label = UILabel()
    label.translatesAutoresizingMaskIntoConstraints = false
    label.text = "DAIL을 불러오는 중입니다"
    label.textColor = UIColor(red: 0.376, green: 0.439, blue: 0.412, alpha: 1)
    label.font = .systemFont(ofSize: 14, weight: .semibold)
    return label
  }()

  private let errorView: UIView = {
    let view = UIView()
    view.translatesAutoresizingMaskIntoConstraints = false
    view.backgroundColor = UIColor(red: 0.969, green: 0.980, blue: 0.973, alpha: 1)
    view.isHidden = true
    return view
  }()

  private let errorLabel: UILabel = {
    let label = UILabel()
    label.translatesAutoresizingMaskIntoConstraints = false
    label.numberOfLines = 0
    label.textAlignment = .center
    label.textColor = UIColor(red: 0.090, green: 0.129, blue: 0.114, alpha: 1)
    label.font = .systemFont(ofSize: 16, weight: .bold)
    return label
  }()

  private lazy var retryButton: UIButton = {
    var configuration = UIButton.Configuration.filled()
    configuration.title = "다시 불러오기"
    configuration.baseBackgroundColor = UIColor(red: 0.184, green: 0.608, blue: 0.463, alpha: 1)
    configuration.cornerStyle = .medium
    let button = UIButton(configuration: configuration)
    button.translatesAutoresizingMaskIntoConstraints = false
    button.addTarget(self, action: #selector(loadInitialPage), for: .touchUpInside)
    return button
  }()

  init(url: URL) {
    self.initialURL = url
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = UIColor(red: 0.969, green: 0.980, blue: 0.973, alpha: 1)

    view.addSubview(webView)
    view.addSubview(loadingView)
    loadingView.addSubview(spinner)
    loadingView.addSubview(loadingLabel)
    view.addSubview(errorView)
    errorView.addSubview(errorLabel)
    errorView.addSubview(retryButton)

    NSLayoutConstraint.activate([
      webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
      webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      webView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),

      loadingView.topAnchor.constraint(equalTo: view.topAnchor),
      loadingView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      loadingView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      loadingView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
      spinner.centerXAnchor.constraint(equalTo: loadingView.centerXAnchor),
      spinner.centerYAnchor.constraint(equalTo: loadingView.centerYAnchor, constant: -18),
      loadingLabel.topAnchor.constraint(equalTo: spinner.bottomAnchor, constant: 12),
      loadingLabel.centerXAnchor.constraint(equalTo: loadingView.centerXAnchor),

      errorView.topAnchor.constraint(equalTo: view.topAnchor),
      errorView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      errorView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      errorView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
      errorLabel.centerXAnchor.constraint(equalTo: errorView.centerXAnchor),
      errorLabel.centerYAnchor.constraint(equalTo: errorView.centerYAnchor, constant: -30),
      errorLabel.leadingAnchor.constraint(greaterThanOrEqualTo: errorView.leadingAnchor, constant: 28),
      errorLabel.trailingAnchor.constraint(lessThanOrEqualTo: errorView.trailingAnchor, constant: -28),
      retryButton.topAnchor.constraint(equalTo: errorLabel.bottomAnchor, constant: 20),
      retryButton.centerXAnchor.constraint(equalTo: errorView.centerXAnchor),
      retryButton.widthAnchor.constraint(greaterThanOrEqualToConstant: 150),
      retryButton.heightAnchor.constraint(greaterThanOrEqualToConstant: 46),
    ])

    loadInitialPage()
  }

  @objc private func loadInitialPage() {
    errorView.isHidden = true
    loadingView.isHidden = false
    spinner.startAnimating()
    webView.load(URLRequest(url: initialURL, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30))
  }

  func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
    errorView.isHidden = true
    loadingView.isHidden = false
    spinner.startAnimating()
  }

  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    spinner.stopAnimating()
    loadingView.isHidden = true
  }

  func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
    show(error: error)
  }

  func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
    show(error: error)
  }

  private func show(error: Error) {
    spinner.stopAnimating()
    loadingView.isHidden = true
    errorLabel.text = "화면을 불러오지 못했습니다.\n\n\(error.localizedDescription)"
    errorView.isHidden = false
  }

  func webView(
    _ webView: WKWebView,
    createWebViewWith configuration: WKWebViewConfiguration,
    for navigationAction: WKNavigationAction,
    windowFeatures: WKWindowFeatures
  ) -> WKWebView? {
    if navigationAction.targetFrame == nil, let url = navigationAction.request.url {
      webView.load(URLRequest(url: url))
    }
    return nil
  }

  func webView(
    _ webView: WKWebView,
    decidePolicyFor navigationAction: WKNavigationAction,
    decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
  ) {
    guard let url = navigationAction.request.url else {
      decisionHandler(.cancel)
      return
    }

    if let scheme = url.scheme?.lowercased(), !["http", "https", "about", "data", "blob"].contains(scheme) {
      UIApplication.shared.open(url)
      decisionHandler(.cancel)
      return
    }

    decisionHandler(.allow)
  }
}
