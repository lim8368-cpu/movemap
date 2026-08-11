#import <React/RCTViewManager.h>
#import <UIKit/UIKit.h>

@interface DAILLiquidGlassView : UIView
@property (nonatomic, assign) NSInteger itemCount;
@property (nonatomic, assign) NSInteger selectedIndex;
@end

@interface DAILLiquidGlassView ()
@property (nonatomic, strong) UIVisualEffectView *containerEffectView;
@property (nonatomic, strong) UIVisualEffectView *baseGlassView;
@property (nonatomic, strong) UIVisualEffectView *selectionGlassView;
@end

@implementation DAILLiquidGlassView

- (instancetype)initWithFrame:(CGRect)frame
{
  self = [super initWithFrame:frame];
  if (self) {
    _itemCount = 4;
    _selectedIndex = 0;
    self.backgroundColor = UIColor.clearColor;
    self.userInteractionEnabled = NO;
    self.accessibilityElementsHidden = YES;
    [self configureEffects];
  }
  return self;
}

- (void)configureEffects
{
  if (@available(iOS 26.0, *)) {
    UIGlassContainerEffect *containerEffect = [UIGlassContainerEffect new];
    containerEffect.spacing = 10.0;
    self.containerEffectView = [[UIVisualEffectView alloc] initWithEffect:containerEffect];

    UIGlassEffect *baseEffect = [UIGlassEffect effectWithStyle:UIGlassEffectStyleRegular];
    baseEffect.interactive = NO;
    baseEffect.tintColor = [UIColor colorWithRed:0.31 green:0.63 blue:0.65 alpha:0.055];
    self.baseGlassView = [[UIVisualEffectView alloc] initWithEffect:baseEffect];
    self.baseGlassView.cornerConfiguration = [UICornerConfiguration capsuleConfiguration];

    UIGlassEffect *selectionEffect = [UIGlassEffect effectWithStyle:UIGlassEffectStyleClear];
    selectionEffect.interactive = YES;
    selectionEffect.tintColor = [UIColor colorWithRed:0.31 green:0.63 blue:0.65 alpha:0.14];
    self.selectionGlassView = [[UIVisualEffectView alloc] initWithEffect:selectionEffect];
    self.selectionGlassView.cornerConfiguration = [UICornerConfiguration capsuleConfiguration];

    [self addSubview:self.containerEffectView];
    [self.containerEffectView.contentView addSubview:self.baseGlassView];
    [self.containerEffectView.contentView addSubview:self.selectionGlassView];
  } else {
    self.baseGlassView = [[UIVisualEffectView alloc] initWithEffect:
      [UIBlurEffect effectWithStyle:UIBlurEffectStyleSystemChromeMaterialLight]];
    self.baseGlassView.layer.cornerCurve = kCACornerCurveContinuous;
    self.baseGlassView.layer.cornerRadius = 31.0;
    self.baseGlassView.clipsToBounds = YES;

    self.selectionGlassView = [[UIVisualEffectView alloc] initWithEffect:
      [UIBlurEffect effectWithStyle:UIBlurEffectStyleSystemUltraThinMaterialLight]];
    self.selectionGlassView.layer.cornerCurve = kCACornerCurveContinuous;
    self.selectionGlassView.layer.cornerRadius = 25.0;
    self.selectionGlassView.clipsToBounds = YES;
    self.selectionGlassView.backgroundColor = [UIColor colorWithWhite:1.0 alpha:0.28];

    [self addSubview:self.baseGlassView];
    [self addSubview:self.selectionGlassView];
  }
}

- (CGRect)selectionFrame
{
  if (self.selectedIndex < 0) return CGRectZero;
  NSInteger count = MAX(self.itemCount, 1);
  CGFloat horizontalInset = 5.0;
  CGFloat verticalInset = 5.0;
  CGFloat availableWidth = MAX(CGRectGetWidth(self.bounds) - horizontalInset * 2.0, 0.0);
  CGFloat itemWidth = availableWidth / count;
  NSInteger index = MIN(MAX(self.selectedIndex, 0), count - 1);
  return CGRectMake(
    horizontalInset + itemWidth * index,
    verticalInset,
    itemWidth,
    MAX(CGRectGetHeight(self.bounds) - verticalInset * 2.0, 0.0)
  );
}

- (void)layoutSubviews
{
  [super layoutSubviews];
  self.containerEffectView.frame = self.bounds;
  self.baseGlassView.frame = self.bounds;
  self.selectionGlassView.hidden = self.selectedIndex < 0;
  if (!self.selectionGlassView.layer.animationKeys.count) {
    self.selectionGlassView.frame = [self selectionFrame];
  }
}

- (void)setItemCount:(NSInteger)itemCount
{
  _itemCount = MAX(itemCount, 1);
  [self setNeedsLayout];
}

- (void)setSelectedIndex:(NSInteger)selectedIndex
{
  NSInteger nextIndex = MIN(MAX(selectedIndex, -1), MAX(self.itemCount - 1, 0));
  if (_selectedIndex == nextIndex) return;
  _selectedIndex = nextIndex;
  self.selectionGlassView.hidden = nextIndex < 0;

  if (!self.window || CGRectIsEmpty(self.bounds)) {
    [self setNeedsLayout];
    return;
  }

  [UIView animateWithDuration:0.34
                        delay:0.0
       usingSpringWithDamping:0.86
        initialSpringVelocity:0.22
                      options:UIViewAnimationOptionBeginFromCurrentState | UIViewAnimationOptionAllowUserInteraction
                   animations:^{
    self.selectionGlassView.frame = [self selectionFrame];
  }
                   completion:nil];
}

@end

@interface DAILLiquidGlassViewManager : RCTViewManager
@end

@implementation DAILLiquidGlassViewManager

RCT_EXPORT_MODULE(DAILLiquidGlassView)
RCT_EXPORT_VIEW_PROPERTY(itemCount, NSInteger)
RCT_EXPORT_VIEW_PROPERTY(selectedIndex, NSInteger)

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

- (UIView *)view
{
  return [DAILLiquidGlassView new];
}

@end
